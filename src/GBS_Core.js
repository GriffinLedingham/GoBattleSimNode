/* GBS_Core.js */

/**
	@file The GoBattleSim simulator core.
	@author BIOWP
*/

const MAX_NUM_POKEMON_PER_PARTY = 6;
const MAX_NUM_PARTIES_PER_PLAYER = 5;
const MAX_NUM_OF_PLAYERS = 21;

const EVENT = {
	Free: "Free",
	Damage: "Damage",
	MoveEffect: "MoveEffect",
	Dodge: "Dodge",
	Protect: "Protect",
	Enter: "Enter",
	Switch: "Switch",
	Nothing: "Nothing",
	Minigame: "Minigame"
};

const ACTION = {
	Fast: "Fast",
	Charged: "Charged",
	Dodge: "Dodge"
};


/**
	The damage formula, calculating how much damage the attack inflicts.
	@param {Pokemon} dmgGiver The Pokemon using the attack.
	@param {Pokemon} dmgReceiver The Pokemon taking the hit.
	@param {Move} move The move being used.
	@param {string} weather The current weather.
	@return {number} The damage value.
*/
function damage(dmgGiver, dmgReceiver, move, weather){
	var stab = 1;	// Same Type Attack Bonus
	if (move.pokeType == dmgGiver.pokeType1 || move.pokeType == dmgGiver.pokeType2){
		stab = Data.BattleSettings.sameTypeAttackBonusMultiplier;
	}
	var wab = 1;	// Weather Attack Bonus
	if (Data.TypeEffectiveness[move.pokeType].boostedIn == weather){
		wab = Data.BattleSettings.weatherAttackBonusMultiplier;
	}
	var fab = dmgGiver.fab || 1;	// Friend Attack Bonus mutiplier
	var mab = dmgGiver[move.moveType + "AttackBonus"] || 1;	// Move Attack Bonus mutiplier (for PvP)
	var effe1 = Data.TypeEffectiveness[move.pokeType][dmgReceiver.pokeType1] || 1;
	var effe2 = Data.TypeEffectiveness[move.pokeType][dmgReceiver.pokeType2] || 1;
	return Math.floor(0.5*dmgGiver.Atk/dmgReceiver.Def*move.power*effe1*effe2*stab*wab*fab*mab) + 1;
}


/**
	The CP formula, calculating the current CP of a Pokemon.
	@param {Object|Pokemon} pkm The Pokemon to calculate CP for. Expected to have Atk, Def and Stm. If not, then must have base stats, IV stats and cpm/level.
	@return {number} The CP value
*/
function calculateCP(pkm){
	var cpm = parseFloat(pkm.cpm);
	if (isNaN(cpm)){
		let levelSetting = getEntry(pkm.level.toString(), Data.LevelSettings, true);
		cpm = levelSetting.cpm;
	}
	var atk = pkm.Atk || (pkm.baseAtk + pkm.atkiv) * cpm;
	var def = pkm.Def || (pkm.baseDef + pkm.defiv) * cpm;
	var stm = pkm.Stm || (pkm.baseStm + pkm.stmiv) * cpm;
	return Math.max(10, Math.floor(atk * Math.sqrt(def * stm)/10));
}

/**
	Find a combination of {level, atkiv, defiv, stmiv} that yields the given CP for a Pokemon.
	@param {Pokemon} pkm The Pokemon to infer level and IVs for. Expected to have baseAtk, baseDef and baseStm.
	@param {number} cp The given CP.
	@return {Object} A set of {level, atkiv, defiv, stmiv} that yields the given CP. If no combination is found, return null.
*/
function inferLevelAndIVs(pkm, cp){
	var minIV = Data.IndividualValues[0].value, maxIV = Data.IndividualValues[Data.IndividualValues.length - 1].value;
	var pkm2 = {baseAtk: pkm.baseAtk, baseDef: pkm.baseDef, baseStm: pkm.baseStm};
	var minLevelIndex = null;
	pkm2.atkiv = pkm2.defiv = pkm2.stmiv = maxIV;
	for (var i = 0; i < Data.LevelSettings.length; i++){
		pkm2.cpm = Data.LevelSettings[i].cpm;
		if (calculateCP(pkm2) <= cp){
			minLevelIndex = i;
		}else{
			break;
		}
	}
	if (minLevelIndex == null)
		return null;
	for (var i = minLevelIndex; i < Data.LevelSettings.length; i++){
		pkm2.level = Data.LevelSettings[i].value;
		pkm2.cpm = Data.LevelSettings[i].cpm;
		for (pkm2.atkiv = minIV; pkm2.atkiv <= maxIV; pkm2.atkiv++){
			for (pkm2.defiv = minIV; pkm2.defiv <= maxIV; pkm2.defiv++){
				for (pkm2.stmiv = minIV; pkm2.stmiv <= maxIV; pkm2.stmiv++){
					if (calculateCP(pkm2) == cp){
						return pkm2;
					}
				}
			}
		}
	}
}



/** 
	@class
	@param {string|Move} cfg Information of the move.
	@param {Object[]} database The database to look up for the move stats. If omitted, will look up all databases
*/
function Move(cfg, database){
	if (Move.prototype.isPrototypeOf(cfg)){ // Copy Construction
		leftMerge(this, cfg);
		return;
	}
	var moveName = (cfg || "").toString().toLowerCase();
	var moveData = null;
	if (database){
		moveData = getEntry(moveName, database);
	}else{
		moveData = getEntry(moveName, Data.FastMoves) || getEntry(moveName, Data.ChargedMoves);
	}
	if (moveData == null){
		throw Error("Unknown Move: " + moveName);
	}
	leftMerge(this, moveData);
}



/** 
	@class
	@param {Object|Pokemon} cfg Keyword arguments for constructing the Pokemon.
*/
function Pokemon(cfg){
	if (Pokemon.prototype.isPrototypeOf(cfg)){ // Copy Construction
		leftMerge(this, cfg);
		return;
	}
	this.master = cfg.master || null;
	this.party = cfg.party || null;
	this.nickname = cfg.nickname || "";
	this.role = (cfg.role || "a").split("_")[0];
	this.raidTier = cfg.raidTier;
	this.immortal = cfg.immortal || false;
	if (this.role.toUpperCase() == this.role){
		this.immortal = true;
		this.role = this.role.toLowerCase();
	}
	this.fab = cfg.fab || 1;
	this.fastAttackBonus = 1;
	this.chargedAttackBonus = 1;
	this.fastMoveLagMs = (this.role == "a" ? Data.BattleSettings.fastMoveLagMs : 0);
	this.chargedMoveLagMs = (this.role == "a" ? Data.BattleSettings.chargedMoveLagMs : 0);
	this.energyDeltaPerHealthLost = Data.BattleSettings.energyDeltaPerHealthLost;
	
	var speciesData = (typeof cfg.species == typeof {} ? cfg.species : getEntry(cfg.name.toString().toLowerCase(), Data.Pokemon));
	if (speciesData == null){
		throw Error("Unknown Pokemon: " + cfg.name);
	}
	// Initialize Basic stats
	this.name = speciesData.name;
	this.icon = cfg.icon || speciesData.icon;
	this.label = cfg.label || speciesData.label;
	this.pokeType1 = speciesData.pokeType1;
	this.pokeType2 = speciesData.pokeType2;
	this.baseAtk = speciesData.baseAtk;
	this.baseDef = speciesData.baseDef;
	this.baseStm = speciesData.baseStm;
	if (cfg.role && cfg.role.includes("_basic")){
		let inferred = inferLevelAndIVs(this, parseInt(cfg.cp));
		if (inferred == null){
			throw Error('No combination of level and IVs are found for ' + this.name);
		}
		cfg.atkiv = this.atkiv = inferred.atkiv;
		cfg.defiv = this.defiv = inferred.defiv;
		cfg.stmiv = this.stmiv = inferred.stmiv;
		cfg.level = this.level = inferred.level;
		this.cpm = inferred.cpm;
	}else{
		this.atkiv = parseInt(cfg.atkiv);
		this.defiv = parseInt(cfg.defiv);
		this.stmiv = parseInt(cfg.stmiv);
		this.level = cfg.level;
		this.cpm = parseFloat(cfg.cpm);
		if (isNaN(this.cpm)){
			if (this.level != undefined){
				let levelSetting = getEntry(this.level.toString(), Data.LevelSettings, true);
				if (levelSetting){
					this.cpm = levelSetting.cpm;
				}
			}
		}
	}
	
	// Initialize Moves
	if (cfg.fmove){
		this.fmove = new Move(cfg.fmove, Data.FastMoves);
	}
	if (cfg.cmove || cfg.cmoves){
		this.cmoves = [];
		if (cfg.cmoves){
			let unique_cmoves = cfg.cmoves.filter(function(item, pos){
				return cfg.cmoves.indexOf(item) == pos;
			});
			for (let cmove of unique_cmoves){
				this.cmoves.push(new Move(cmove, Data.ChargedMoves));
			}
			this.cmove = this.cmoves[0];
		}else{
			this.cmove = new Move(cfg.cmove, Data.ChargedMoves);
			this.cmoves.push(this.cmove);
		}
		if (cfg.cmove2){
			this.cmoves.push(new Move(cfg.cmove2, Data.ChargedMoves));
		}
	}
	
	// Initialize strategies
	this.strategy = new Strategy();
	this.strategy.bind(this);
	this.strategy.setActionStrategy(cfg.strategy);
	this.strategy.setShieldStrategy(cfg.strategy2);
	
	this.init();
}

/** 
	Initialize the Pokemon's battle states. Call this method before a new battle.
*/
Pokemon.prototype.init = function(){
	this.calculateStats();
	
	// Battle state variables
	this.active = false;
	this.damageReductionExpiration = -1;
	this.damageReductionPercent = 0;
	this.queuedAction = null;
	this.projectedRivalActions = new Timeline();
	this.strategy.init();
	
	// Performance metrics. Does not affect battle outcome
	this.timeEnterMs = 0;
	this.activeDurationMs = 0;
	this.numOfDeaths = 0;
	this.tdo = 0;
	this.tdoFast = 0;
	this.numFastAttacks = 0;
	this.numChargedAttacks = 0;
	
	this.calculateStats();
	this.heal();
}

/** 
	Re-calculate and set the core stats of the Pokemon.
*/
Pokemon.prototype.calculateStats = function(){
	if (this.role == "gd"){ // gym defender
		this.Atk = (this.baseAtk + this.atkiv) * this.cpm;
		this.Def = (this.baseDef + this.defiv) * this.cpm;
		this.Stm = (this.baseStm + this.stmiv) * this.cpm;
		this.maxHP = 2 * Math.floor(this.Stm);
	}else if (this.role == "rb") { // raid boss
		let raidTierSetting = getEntry(this.raidTier.toString(), Data.RaidTierSettings, true);
		this.cpm = raidTierSetting.cpm;
		this.Atk = (this.baseAtk + 15) * this.cpm;
		this.Def = (this.baseDef + 15) * this.cpm;
		this.maxHP = raidTierSetting.HP;
	}else{ // default, attacker
		this.Atk = (this.baseAtk + this.atkiv) * this.cpm;
		this.Def = (this.baseDef + this.defiv) * this.cpm;
		this.Stm = (this.baseStm + this.stmiv) * this.cpm;
		this.maxHP = Math.floor(this.Stm);
	}
}

/**
	Check whether the Pokemon is alive (is able to stay in battle).
	@return {boolean} True if its HP > 0 or it's immortal and false otherwise.
*/
Pokemon.prototype.isAlive = function(){
	return this.HP > 0 || this.immortal;
}

/** 
	Fully heal the Pokemon and set its energy to 0
*/
Pokemon.prototype.heal = function(){
	this.HP = this.maxHP;
	this.energy = 0;
	this.queuedAction = null;
}

/** 
	The Pokemon gains/loses energy.
	@param {number} energyDelta The amount of energy change. Positive value indicates energy gain.
*/
Pokemon.prototype.gainEnergy = function(energyDelta){
	this.energy += energyDelta;
	if (this.energy > Data.BattleSettings.maximumEnergy){
		this.totalEnergyOvercharged += this.energy - Data.BattleSettings.maximumEnergy;
		this.energy = Data.BattleSettings.maximumEnergy;
	}
}

/** 
	The Pokemon takes damage and changes HP.
	@param {number} dmg The amount of HP to lose.
*/
Pokemon.prototype.takeDamage = function(dmg){
	this.HP -= dmg;
	this.gainEnergy(Math.ceil(dmg * this.energyDeltaPerHealthLost));
	if (!this.isAlive()){
		this.numOfDeaths++;
	}
}


/** 
	Decides which charged move to use based on an opponent.
	@enemy {Pokemon} The opponent based on which to select charged move.
	@weather {string} The current weather.
*/
Pokemon.prototype.chooseDefaultChargedMove = function(enemy, weather){
	var best_cmove = this.cmoves[0];
	var best_dpe = 0;
	for (let cmove of this.cmoves){
		let dpe = damage(this, enemy, cmove, weather) / (-cmove.energyDelta)**2;
		if (dpe > best_dpe){
			best_cmove = cmove;
			best_dpe = dpe;
		}
	}
	this.cmove = best_cmove;
}

/** 
	Increase the Pokemon's TDO to keep track of its battle performance.
	@param {number} dmg The amount of damage attributed to the Pokemon.
	@param {string} moveType The type of the move.
*/
Pokemon.prototype.attributeDamage = function(dmg, moveType){
	this.tdo += dmg;
	if (moveType == 'fast'){
		this.tdoFast += dmg;
	}
}

/** 
	Get the battle performance metrics of the Pokemon.
	@return {Object} Battle performance metrics.
*/
Pokemon.prototype.getStatistics = function(){
	return {
		name: this.name,
		nickname: this.nickname,
		hp: this.HP,
		energy: this.energy,
		tdo: this.tdo,
		tdoFast: this.tdoFast,
		duration: this.activeDurationMs/1000,
		dps: this.tdo / (this.activeDurationMs/1000),
		numFastAttacks: this.numFastAttacks,
		numChargedAttacks: this.numChargedAttacks
	};
}
/* End of Class <Pokemon> */



/** 
	@class
	@param {Object|Party} cfg Keyword arguments for constructing the party.
*/
function Party(cfg){
	if (Party.prototype.isPrototypeOf(cfg)){ // Copy Construction
		leftMerge(this, cfg);
		return;
	}
	this.revive = cfg.revive;
	this.pokemon = [];
	for (let pokemon of cfg.pokemon){
		for (var r = 0; r < (pokemon.copies || 1); r++){
			this.pokemon.push(new Pokemon(pokemon));
		}
	}
	this.headingPokemonIndex = 0;
	this.heal();
}

/** 
	Initialize the party. Call this method before a new battle.
*/
Party.prototype.init = function(){
	for (let pokemon of this.pokemon){
		pokemon.party = this;
		pokemon.init();
	}
	this.headingPokemonIndex = 0;
}

/**
	Get a Pokemon by ID.
	@param {number} id The ID to look up.
	@return {Pokemon} The Pokemon with the matched ID.
*/
Party.prototype.getPokemonById = function(id){
	for (let pokemon of this.pokemon){
		if (pokemon.id == id)
			return pokemon;
	}
	return null;
}

/** 
	Get the heading Pokemon of the party.
	@return {Pokemon} The heading Pokemon.
*/
Party.prototype.getHead = function(){
	return this.pokemon[this.headingPokemonIndex];
}

/** 
	Set the heading Pokemon of the party.
	@param {pokemon} The heading Pokemon.
*/
Party.prototype.setHead = function(pokemon){
	this.setHeadById(pokemon.id);
}

/**
	Set the heading Pokemon to the Pokemon with given ID.
	@param {number} id The ID to look up.
*/
Party.prototype.setHeadById = function(id){
	for (var i = 0; i < this.pokemon.length; i++){
		if (this.pokemon[i].id == id){
			this.headingPokemonIndex = i;
			return;
		}
	}
	throw Error("No Pokemon with id {" + id + "} found in this party");
}

/**
	Set heading Pokemon to the next alive Pokemon in the party.
	@return {boolean} true if there is such Pokemon in the party and false otherwise.
*/
Party.prototype.setHeadToNext = function(){
	for (var i = (this.headingPokemonIndex + 1) % this.pokemon.length; i != this.headingPokemonIndex; i = (i + 1) % this.pokemon.length){
		if (this.pokemon[i].isAlive()){
			this.headingPokemonIndex = i;
			return true;
		}
	}
	return false;
}

/** 
	Fully heal all Pokemon of the party and set the heading pokemon to the first one.
*/
Party.prototype.heal = function (){
	for (let pokemon of this.pokemon){
		pokemon.heal();
	}
	this.headingPokemonIndex = 0;
}

/** 
	Get the battle performance metrics of the party.
	@return {Object} Battle performance metrics.
*/
Party.prototype.getStatistics = function(){
	let sum_tdo = 0, sum_numOfDeaths = 0;
	for (let pokemon of this.pokemon){
		sum_tdo += pokemon.tdo;
		sum_numOfDeaths += pokemon.numOfDeaths;
	}
	return {
		tdo: sum_tdo,
		numOfDeaths: sum_numOfDeaths
	};
}




/**
	@class
	@param {Object|Player} cfg Keyword arguments for constructing the player.
*/
function Player(cfg){
	if (Player.prototype.isPrototypeOf(cfg)){ // Copy Construction
		leftMerge(this, cfg);
		return;
	}
	this.index = cfg.index;
	this.fab = cfg.fab || getFriendMultiplier(cfg.friend);
	this.team = cfg.team;
	this.rivals = [];
	this.parties = [];
	for (let party of cfg.parties){
		this.parties.push(new Party(party));
	}
	for (let party of this.parties){
		for (pokemon of party.pokemon){
			pokemon.master = this;
		}
	}
	this.headingPartyIndex = 0;
}

/** 
	Initialize the player. Call this method before a new battle.
*/
Player.prototype.init = function(){
	for (let party of this.parties){
		party.init();
	}
	this.headingPartyIndex = 0;
	this.protectShieldLeft = 2;
	this.switchingCooldownExpiration = -1;
}

/** 
	Get the heading Pokemon of the player.
	@return {Pokemon} The heading Pokemon.
*/
Player.prototype.getHead = function(){
	let party = this.getHeadParty();
	return party ? party.getHead() : null;
}

/** 
	Set the heading Pokemon of the player.
	@param {Pokemon} pokemon The heading Pokemon.
*/
Player.prototype.setHead = function(pokemon){
	let party = this.getHeadParty();
	if (party){
		party.setHead(pokemon);
	}else{
		throw new Error("Player has no heading party");
	}
}

/**
	Get a Pokemon by ID.
	@param {number} id The ID to look up.
	@return {Pokemon} The Pokemon with the matched ID.
*/
Player.prototype.getPokemonById = function(id){
	for (let party of this.parties){
		var pkm = party.getPokemonById(id);
		if (pkm)
			return pkm;
	}
	return null;
}

/**
	Set the heading Pokemon to the Pokemon with given ID.
	@param {number} id The ID to look up.
*/
Player.prototype.setHeadById = function(id){
	for (let party of this.parties){
		if (party.getPokemonById(id)){
			party.setHeadById(id);
			return;
		}
	}
	throw Error("No Pokemon with id {" + id + "} found in this player");
}


/** 
	Get the heading party of the player.
	@return {Party} The heading party.
*/
Player.prototype.getHeadParty = function(){
	return this.parties[this.headingPartyIndex];
}

/**
	Select the next alive Pokemon of the active party of the player.
	@return {boolean} true if the heading party has next alive Pokemon and false otherwise
*/
Player.prototype.setHeadToNext = function(){
	return this.getHeadParty().setHeadToNext();
}

/**
	Select the next available party.
	@return true if there is next party and false otherwise
*/
Player.prototype.setHeadPartyToNext = function(){
	if (++this.headingPartyIndex < this.parties.length){
		return true;
	}else{
		--this.headingPartyIndex;
		return false;
	}
}

/** 
	Get the battle performance metrics of the player.
	@return {Object} Battle performance metrics.
*/
Player.prototype.getStatistics = function(battleDurationMs){
	let sum_tdo = 0, sum_numOfDeaths = 0;
	for (let party of this.parties){
		let party_stat = party.getStatistics();
		sum_tdo += party_stat.tdo;
		sum_numOfDeaths += party_stat.numOfDeaths;
	}
	return {
		name: "Player " + (this.index + 1),
		tdo: sum_tdo,
		dps: sum_tdo / battleDurationMs,
		numOfDeaths: sum_numOfDeaths
	};
}



/**
	@class
	@classdesc A priority queue using 't' as key.
*/
function Timeline(){
	this.list = [];
}

/** 
	Add an item.
	@param {Object} e The item to add.
*/
Timeline.prototype.enqueue = function(e){
	this.list.push(e);
	for (var i = this.list.length - 1, j = i - 1; j >= 0; j = --i - 1){
		if (this.list[j].t > this.list[i].t){
			let temp = this.list[i];
			this.list[i] = this.list[j];
			this.list[j] = temp;
		}else{
			break;
		}
	}
}

/**
	Remove the item with the smallest key.
	@return {Object} The item with the smallest key.
*/
Timeline.prototype.dequeue = function(){
	if (this.list.length == 0){
		return null;
	}
	return this.list.shift();
}



/**
	@class
	@classdesc Strategy class for choosing action and whether to use Protect Shield.
	@param {Object} kwargs Keyword arguments for initialization.
*/
function Strategy(kwargs){
	this.subject = null;
	this.actionStrategy = this.actionStrategyNoDodge;
	this.shieldStrategyString = "";
	this.shieldStrategy = (kwargs => true);
	this.init();
}

/**
	Bind a Pokemon to the strategy instance.
	@param {Pokemon} pokemon The pokemon to bind.
*/
Strategy.prototype.bind = function(pokemon){
	this.subject = pokemon;
	this.dodgeAttackTypes = [];
	this.burstAttackStatus = 0; // 0: never burst; -1: burst, inactive;  1: burst, active
}

/**
	Initialize the parameters for keeping track of strategy.
*/
Strategy.prototype.init = function(){
	// For action strategy
	this.attackCount = 0;
	// For shield strategy
	this.setShieldStrategy(this.shieldStrategyString);
}

/**
	Set the action strategy.
	@param {String} str A string representing the strategy.
*/
Strategy.prototype.setActionStrategy = function(str){
	if (str == "strat0"){
		this.actionStrategy = this.actionStrategyDefender;
	}else if (str == "strat1"){
		this.actionStrategy = this.actionStrategyNoDodge;
	}else if (str == "strat2"){
		this.dodgeAttackTypes = [ACTION.Charged];
		this.actionStrategy = this.actionStrategyDodge;
	}else if (str == "strat3"){
		this.dodgeAttackTypes = [ACTION.Fast, ACTION.Charged];
		this.actionStrategy = this.actionStrategyDodge;
	}else if (str == "strat4"){
		this.burstAttackStatus = -1;
		this.actionStrategy = this.actionStrategyNoDodge;
	}
}

/**
	Get the action decision.
	@param {Object} kwargs Keyword arguments as parameters for making decision.
	@return {Object} An action object.
*/
Strategy.prototype.getActionDecision = function(kwargs){
	return this.actionStrategy(kwargs);
}

/**
	Get the burst charge attack decision.
	@param {Object} kwargs Keyword arguments as parameters for making decision.
	@return {Boolean} True for using a charge right away, false for holding it (and burst later).
*/
Strategy.prototype.getBurstDecision = function(kwargs){
	if (this.burstAttackStatus == 0){
		return true;
	} else if (this.burstAttackStatus == 1){
		if (this.projectedEnergy + this.subject.cmove.energyDelta * 2 < 0){
			this.burstAttackStatus = -1;
		}
		return true;
	} else { // this.burstAttackStatus == -1
		if (this.projectedEnergy >= Data.BattleSettings.maximumEnergy){
			this.burstAttackStatus = 1;
			return true;
		} else if (this.subject.master.rivals[0].getHead().energy >= Data.BattleSettings.maximumEnergy) {
			this.burstAttackStatus = 1;
			return true;
		} else {
			return false;
		}
	}
}

/**
	Set the shield strategy.
	@param {String} str A string representing the strategy.
*/
Strategy.prototype.setShieldStrategy = function(str){
	this.shieldStrategyString = str || "";
	var arr = this.shieldStrategyString.split(",");
	if (arr.length < 2){
		arr.push("0");
	}else if (arr.length >= 2){
		arr = arr.slice(0, 2);
	}
	this.attacksToTank = [];
	for (let a of arr){
		var n = parseInt(a);
		if (n >= 0){
			this.attacksToTank.push(n);
		}else if (a == '*'){
			this.attacksToTank.push(a);
		}else{
			this.attacksToTank.push(0);
		}
	}
}

/**
	Get the shield decision.
	@param {Object} kwargs Keyword arguments as parameters for making decision.
	@return {Boolean} True for deciding to use shield and false otherwise.
*/
Strategy.prototype.getShieldDecision = function(kwargs){
	if (this.attacksToTank.length == 0){
		return false;
	}
	var a = this.attacksToTank[0];
	if (a > 0){
		this.attacksToTank[0]--;
		return false;
	}else if (a == 0){
		this.attacksToTank.shift();
		return true;
	}else if (a == '*'){
		return false;
	}
}

/**
	Defender AI strategy.
*/
Strategy.prototype.actionStrategyDefender = function(kwargs){
	let actionName, delay;
	let actualAttackCount = this.attackCount + (kwargs.currentAction ? 1 : 0);
	if (actualAttackCount >= 2){
		this.projectedEnergy = this.subject.energy;
		if (kwargs.currentAction){
			if (kwargs.currentAction.name == ACTION.Fast){
				this.projectedEnergy += this.subject.fmove.energyDelta;
			}else if (kwargs.currentAction.name == ACTION.Charged){
				this.projectedEnergy += this.subject.cmove.energyDelta;
			}
		}
		if (this.projectedEnergy + this.subject.cmove.energyDelta >= 0 && Math.random() <= 0.5){
			actionName = ACTION.Charged;
		}else{
			actionName = ACTION.Fast;
		}
		delay = 1500 + round(1000 * Math.random()); // Add the standard defender delay
	}else if (actualAttackCount == 1){ // The second action
		actionName = ACTION.Fast;
		delay = Math.max(0, 1000 - this.subject.fmove.duration);
	}else{ // The first action
		actionName = ACTION.Fast;
		delay = 500;
	}
	return {
		name: actionName,
		delay: delay
	};
}

/**
	Attacker strategy: No dodge
*/
Strategy.prototype.actionStrategyNoDodge = function(kwargs){
	this.projectedEnergy = this.subject.energy;
	let currentAction = kwargs.currentAction;
	if (currentAction){
		if (currentAction.name == ACTION.Fast){
			this.projectedEnergy += this.subject.fmove.energyDelta;
		}else if (currentAction.name == ACTION.Charged){
			this.projectedEnergy += this.subject.cmove.energyDelta;
		}
	}
	if (this.projectedEnergy + this.subject.cmove.energyDelta >= 0 && this.getBurstDecision(kwargs)){
		return {name: ACTION.Charged, delay: 0};
	}else{
		return {name: ACTION.Fast, delay: 0};
	}
}

/**
	Attacker strategy: Dodge
*/
Strategy.prototype.actionStrategyDodge = function(kwargs){
	if (kwargs.t < kwargs.tFree){
		return;
	}
	let rivalAttackAction = this.subject.projectedRivalActions.dequeue();
	while (rivalAttackAction){
		if (this.dodgeAttackTypes.includes(rivalAttackAction.name))
			break;
		rivalAttackAction = this.subject.projectedRivalActions.dequeue();
	}
	if (!rivalAttackAction){
		return this.actionStrategyNoDodge(kwargs);
	}
	var enemy_move = (rivalAttackAction.name == ACTION.Fast ? rivalAttackAction.from.fmove : rivalAttackAction.from.cmove);
	var hurtTime = rivalAttackAction.t + enemy_move.dws;
	if (this.damageReductionExpiration >= hurtTime){
		return this.actionStrategyNoDodge(kwargs);
	}
	let dmg = damage(rivalAttackAction.from, this.subject, enemy_move, kwargs.weather)
	let dodgedDmg = kwargs.dodgeBugActive ? dmg : Math.max(1, Math.floor(dmg * (1 - Data.BattleSettings.dodgeDamageReductionPercent)));
	if (dodgedDmg >= this.subject.HP){
		return this.actionStrategyNoDodge(kwargs);
	}
	let timeTillHurt = hurtTime - kwargs.tFree;
	if (this.subject.energy + this.subject.cmove.energyDelta >= 0 && timeTillHurt > this.subject.cmove.duration + this.subject.chargedMoveLagMs){
		// Fit in another charge move
		this.subject.projectedRivalActions.enqueue(rivalAttackAction); // Put the broadcasted action for next decision making
		return {name: ACTION.Charged, delay: 0};
	}else if (timeTillHurt > this.subject.fmove.duration + this.subject.fastMoveLagMs){
		// Fit in another fast move
		this.subject.projectedRivalActions.enqueue(rivalAttackAction); // Put the broadcasted action for next decision making
		return {name: ACTION.Fast, delay: 0};
	}else if (timeTillHurt >= 0){
		// Has time to dodge, and delay a little bit to wait for damage window if necessary
		return {
			name: ACTION.Dodge,
			delay: Math.max(0, timeTillHurt - Data.BattleSettings.dodgeWindowMs + 1)
		};
	}else {
		return this.actionStrategyNoDodge(kwargs);
	}
}



/**
	@class
	@classdesc The highest-level class, where the battle takes place.
	@param {Object} cfg The structured simulation input.
*/
function World(cfg){
	// Configure general parameters
	this.battleMode = cfg.battleMode;
	this.timelimit = parseInt(cfg.timelimit);
	if (!this.timelimit > 0){
		this.timelimit = -1;
	}
	this.weather = cfg.weather || "EXTREME";
	this.hasLog = cfg.hasLog || cfg.aggregation == "enum";
	this.dodgeBugActive = parseInt(cfg.dodgeBugActive) || false;
	
	// Configure players
	this.players = [];
	for (let player of cfg.players){
		this.players.push(new Player(player));
	}
	// Configure matchups
	for (let player of this.players){
		for (let player2 of this.players){
			if (player2.team != player.team){ // If you are not in my team, then you are my enemy!
				player.rivals.push(player2);
			}
		}
	}
	// Give each player an index for battle log usage
	// Give each Pokemon a unique ID for later comparison purpose
	let pokemon_id = 0, player_index = 0;
	for (player of this.players){
		player.index = player_index++;
		for (party of player.parties){
			for (pokemon of party.pokemon){
				pokemon.id = pokemon_id++;
				pokemon.fab = player.fab;
				if (this.battleMode == "pvp"){
					pokemon.fastAttackBonus = Data.BattleSettings.fastAttackBonusMultiplier;
					pokemon.chargedAttackBonus = Data.BattleSettings.chargedAttackBonusMultiplier;
					pokemon.energyDeltaPerHealthLost = 0;
					pokemon.fastMoveLagMs = 0;
					pokemon.chargedMoveLagMs = 0;
				}
			}
		}
	}
	// Nullify revive strategy if unlimited time
	if (this.timelimit < 0){
		for (let player of this.players){
			if (player.team == "0"){
				for (let party of player.parties){
					party.revive = false;
				}
			}
		}
	}
	this.init();
}

/** 
	Initialize for a new battle.
*/
World.prototype.init = function(){
	for (let player of this.players){
		player.init();
	}
	this.t = Data.BattleSettings.arenaEntryLagMs;
	this.battleStartMs = this.t;
	this.battleDurationMs = 0;
	this.minigameEndMs = 0;
	
	this.defeatedTeam = "";
	this.faintedPokemon = [];
	
	this.timeline = new Timeline();
	for (let player of this.players){
		this.timeline.enqueue({
			name: EVENT.Enter, t: this.t, subject: player.getHead()
		});
	}
	this.log = [];
}

/**
	Get a Pokemon by ID.
	@param {number} id The ID to look up.
	@return {Pokemon} The Pokemon with the matched ID.
*/
World.prototype.getPokemonById = function(id){
	for (let player of this.players){
		var pkm = player.getPokemonById(id);
		if (pkm)
			return pkm;
	}
	return null;
}

/**
	Register the Fast attack action of a Pokemon by queuing appropriate events.
	@param {Pokemon} pkm The pokemon who performs the action.
	@param {Object} action The action object.
	@return {number} The time when the Pokemon will be free again for another action.
*/
World.prototype.registerFast = function(pkm, action){
	var tAction = this.t + action.delay || 0 + pkm.fastMoveLagMs;
	this.timeline.enqueue({
		name: EVENT.Damage, t: tAction + pkm.fmove.dws, subject: pkm, move: pkm.fmove
	});
	return tAction + pkm.fmove.duration;
}

/**
	Register the Charged attack action of a Pokemon by queuing appropriate events.
	@param {Pokemon} pkm The pokemon who performs the action.
	@param {Object} action The action object.
	@return {number} The time when the Pokemon will be free again for another action.
*/
World.prototype.registerCharged = function(pkm, action){
	var tAction = this.t + action.delay || 0 + pkm.chargedMoveLagMs;
	if (pkm.energy + pkm.cmove.energyDelta < 0){ // Energy requirement check
		console.log(pkm, this.t);
		throw Error("Insufficient energy");
	}
	if (this.battleMode == "pvp"){
		this.timeline.enqueue({
			name: EVENT.Minigame, t: tAction, subject: pkm, move: pkm.cmove
		});
		return tAction + Data.BattleSettings.minigameDurationMs;
	}else{
		this.timeline.enqueue({
			name: EVENT.Damage, t: tAction + pkm.cmove.dws, subject: pkm, move: pkm.cmove
		});
		return tAction + pkm.cmove.duration;
	}
}

/**
	Register the Dodge action of a Pokemon by queuing appropriate events.
	@param {Pokemon} pkm The pokemon who performs the action.
	@param {Object} action The action object.
	@return {number} The time when the Pokemon will be free again for another action.
*/
World.prototype.registerDodge = function(pkm, action){
	var tAction = this.t + action.delay || 0;
	this.timeline.enqueue({
		name: EVENT.Dodge, t: tAction, subject: pkm
	});
	return tAction + Data.BattleSettings.dodgeDurationMs;
}

/**
	Handles Free event.
	@param {Object} e The event to handle.
*/
World.prototype.handleFree = function(e){
	if (!e.subject.active)
		return;
	let currentAction = e.subject.queuedAction;
	let tFree = this.t;
	if (currentAction){
		tFree = this["register" + currentAction.name](e.subject, currentAction);
	}
	if (currentAction && (e.subject.role == "gd" || e.subject.role == "rb")){
		// Gym Defenders and Raid Bosses are forced to broadcast
		currentAction.t = this.t + currentAction.delay || 0;
		currentAction.from = e.subject;
		for (let rival of e.subject.master.rivals){
			let target = rival.getHead();
			if (target && target.active){
				target.projectedRivalActions.enqueue(currentAction);
			}
		}
	}
	e.subject.queuedAction = e.subject.strategy.getActionDecision({
		t: this.t, tFree: tFree, currentAction: currentAction, weather: this.weather, dodgeBugActive: this.dodgeBugActive
	});
	this.timeline.enqueue({
		name: EVENT.Free, t: tFree, subject: e.subject
	});
}

/**
	Handles Damage Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleDamage = function(e){
	if (!e.subject.active){
		e.name = ""; // To ignore it
		return;
	}
	e.subject.gainEnergy(e.move.energyDelta);
	e.subject.strategy.attackCount++;
	if (e.move.moveType == "fast"){
		e.subject.numFastAttacks++;
	}else{
		e.subject.numChargedAttacks++;
	}
	for (let rival of e.subject.master.rivals){
		let target = rival.getHead();
		if (!(target && target.active)){ 
			continue;
		}
		let dmg = damage(e.subject, target, e.move, this.weather);
		if (this.t < target.damageReductionExpiration){
			dmg = Math.max(1, Math.floor(dmg * (1 - target.damageReductionPercent)));
		}
		e.subject.attributeDamage(dmg, e.move.moveType);
		target.takeDamage(dmg);
		if (!target.isAlive()){
			target.active = false;
			this.faintedPokemon.push(target);
		}
	}
}

/**
	Handles MoveEffect Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleMoveEffect = function(e){
	// Not Yet implemented
}

/**
	Handles Dodge Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleDodge = function(e){
	e.subject.damageReductionExpiration = this.t + Data.BattleSettings.dodgeWindowMs;
	e.subject.damageReductionPercent = Data.BattleSettings.dodgeDamageReductionPercent;
}

/**
	Handles Minigame Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleMinigame = function(e){
	if (!e.subject.active)
		return;
	var delayedEvents = [], concurrentMinigamesCount = 1;
	for (let e2 of this.timeline.list){
		if (e2.t == this.t && e2.name == EVENT.Minigame){
			e2.t = e2.t + concurrentMinigamesCount * Data.BattleSettings.minigameDurationMs;
			concurrentMinigamesCount++;
		}else if (e2.name == EVENT.Free){
			delayedEvents.push(e2);
		}else if (e2.name == EVENT.Enter || e2.name == EVENT.Switch){
			// Re-schedule the minigame to the time when the opponent becomes active
			e.t = e2.t;
			return this.timeline.enqueue(e);
		}else if (e2.t == this.t && e2.name == EVENT.Damage && e2.move.moveType == "fast"){
			// Give priority to rival fast attack event since it could KO the subject
			return this.timeline.enqueue(e);
		}
	}
	this.minigameEndMs = this.t + concurrentMinigamesCount * Data.BattleSettings.minigameDurationMs;
	for (let e2 of delayedEvents){
		e2.t = this.minigameEndMs;
	}
	for (let rival of e.subject.master.rivals){ // Ask each enemy whether to use Protect Shield
		var enemy = rival.getHead();
		var hasMadeShieldDecision = false;
		for (var j = this.log.length - 1; j >= 0; j--){
			let e2 = this.log[j];
			if (e2.t < this.t){
				break;
			}else if (e2.index == rival.index && (e2.name == EVENT.Protect || e2.name == EVENT.Nothing)){
				hasMadeShieldDecision = true; break;
			}
		}
		if (hasMadeShieldDecision){
			continue;
		}
		this.timeline.enqueue({
			name: (enemy.master.protectShieldLeft > 0 && enemy.strategy.getShieldDecision() ? EVENT.Protect : EVENT.Nothing), t: this.t, subject: enemy
		});
	}
	this.timeline.enqueue({
		name: EVENT.Damage, t: this.t + Math.round(0.5 * Data.BattleSettings.minigameDurationMs), subject: e.subject, move: e.subject.cmove
	});
}

/**
	Handles Protect Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleProtect = function(e){
	if (!(e.subject.master.protectShieldLeft > 0)){
		throw Error("No protect shield left");
	}
	e.subject.damageReductionExpiration = this.t + Data.BattleSettings.minigameDurationMs;
	e.subject.damageReductionPercent = Data.BattleSettings.protectShieldDamageReductionPercent;
	e.subject.master.protectShieldLeft--;
}

/**
	Handles Enter Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleEnter = function(e){
	e.subject.master.getHead().active = false;
	e.subject.master.setHead(e.subject);
	e.subject.timeEnterMs = this.t;
	e.subject.active = true;
	e.subject.queuedAction = null;
	this.timeline.enqueue({
		name: EVENT.Free, t: this.t, subject: e.subject
	});
	for (let rival of e.subject.master.rivals){
		var enemy = rival.getHead();
		e.subject.chooseDefaultChargedMove(enemy, this.weather);
		enemy.chooseDefaultChargedMove(e.subject, this.weather);
	}
}

/**
	Handles Switch Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleSwitch = function(e){
	var player = e.subject.master;
	e.subject.active = false;
	player.setHead(e.object);
	e.object.timeEnterMs = this.t;
	e.object.active = true;
	this.timeline.enqueue({
		name: EVENT.Free, t: this.t, subject: e.object
	});
	for (let rival of e.subject.master.rivals){
		rival.getHead().chooseDefaultChargedMove(e.object, this.weather);
	}
	player.switchingCooldownExpiration = this.t + Data.BattleSettings.switchingCooldownDurationMs;
}

/**
	Handles Nothing Event.
	@param {Object} e The event to handle.
*/
World.prototype.handleNothing = function(e){
	// Do nothing
}

/**
	Process fainted Pokemon as the result of this turn.
*/
World.prototype.processFaintedPokemon = function(){
	for (let pkm of this.faintedPokemon){
		let player = pkm.master;
		let party = player.getHeadParty();
		pkm.activeDurationMs += this.t - pkm.timeEnterMs;
		if (pkm.role == "gd"){
			// A gym defender's fainting will reset the clock
			let curBattleDuration = this.t - this.battleStartMs;
			for (let e of this.timeline.list){
				e.t -= curBattleDuration;
			}
			this.battleDurationMs += curBattleDuration;
			this.t = 0;
			this.battleStartMs = 0;
		}
		if (player.setHeadToNext()){ // Select next Pokemon from current party
			this.timeline.enqueue({
				name: EVENT.Enter, t: Math.max(this.t + Data.BattleSettings.swapDurationMs, this.minigameEndMs), subject: player.getHead()
			});
		}else if (party.revive){ // Max revive current party and re-lobby
			party.heal();
			this.timeline.enqueue({
				name: EVENT.Enter, 
				t: this.t + Data.BattleSettings.rejoinDurationMs + Data.BattleSettings.itemMenuAnimationTimeMs + party.pokemon.length * Data.BattleSettings.maxReviveTimePerPokemonMs,
				subject: player.getHead()
			});
		}else if (player.setHeadPartyToNext()){ // Select next Party and re-lobby
			this.timeline.enqueue({
				name: EVENT.Enter, 
				t: this.t + Data.BattleSettings.rejoinDurationMs,
				subject: player.getHead()
			});
		}else{ // This player is done. Check if his team is defeated
			if (this.isTeamDefeated(player.team)){
				this.defeatedTeam = player.team;
			}
		}
	}
	this.faintedPokemon = [];
}

/**
	Check if any player of the team is still in game.
	@param {string} team The team to check whether it's defeated or not.
	@return {boolean} true if it's defeated and false otherwise.
*/
World.prototype.isTeamDefeated = function(team){
	for (let player of this.players){
		if (player.team == team){
			let pokemon = player.getHead();
			if (pokemon && pokemon.isAlive()){
				return false;
			}
		}
	}
	return true;
}

/**
	Check whether the battle has ended.
	@return {boolean} true if the battle should end.
*/
World.prototype.hasBattleEnded = function(){
	return this.defeatedTeam || (this.t + Data.BattleSettings.arenaEarlyTerminationMs > this.timelimit && this.timelimit > 0);
}

/**
	Simulate a new battle.
*/
World.prototype.battle = function(){
	while (!this.hasBattleEnded()){
		let e = this.timeline.dequeue();
		this.t = e.t;
		// Process the event
		this["handle" + e.name](e);
		// Append to log if hasLog is true
		if (this.hasLog){
			this.writeLog(e);
		}
		// Check if some Pokemon fainted and handle it
		this.processFaintedPokemon();
	}
	
	// Battle has ended, some leftovers to handle	
	this.battleDurationMs += this.t - this.battleStartMs;
	for (let player of this.players){
		let pkm = player.getHead();
		if (pkm && pkm.active){
			pkm.activeDurationMs += this.t - pkm.timeEnterMs;
		}
	}
}

/**
	Load and process the event from log
	@param {Object} e Event to read.
*/
World.prototype.readLog = function(e){
	if (!(e.t >= this.t)){
		throw Error("Invalid event time: " + e.t);
	}
	this.t = e.t;
	while (this.timeline.list.length > 0 && this.timeline.list[0].t < this.t){
		this.timeline.list.shift(); // Remove all outdated events
	}
	if (e.name == EVENT.Enter){
		e.subject = this.getPokemonById(parseInt(e.value));
	}else if (e.name == EVENT.Switch){
		e.subject = this.players[e.index].getHead();
		e.object = this.getPokemonById(parseInt(e.value));
	}else if (e.name == EVENT.Damage || e.name == EVENT.Minigame){
		e.subject = this.players[e.index].getHead();
		if (e.value == e.subject.fmove.name){
			e.move = e.subject.fmove;
		}else{
			for (let move of e.subject.cmoves){
				if (e.value == move.name){
					e.move = move;
					e.subject.cmove = move; // Overwrite default charged
				}
			}
		}
	}else if (e.name == EVENT.Dodge){
		e.subject = this.players[e.index].getHead();
	}else if (e.name == EVENT.Protect){
		e.subject = this.players[e.index].getHead();
	}else if (e.name == EVENT.Nothing){
		e.subject = this.players[e.index].getHead();
	}else{
		throw Error("Unreadable Event Type: " + e.name);
	}
	this["handle" + e.name](e);
	if (this.hasLog){
		this.writeLog(e);
	}
	this.processFaintedPokemon();
}

/**
	Resume the battle after reading and loading some log events.
*/
World.prototype.resume = function(){
	var hasFreeEvent = new Array(this.players.length);
	for (let e of this.timeline.list){
		if (e.name == EVENT.Free || e.name == EVENT.Enter || e.name == EVENT.Switch){
			hasFreeEvent[e.subject.master.index] = true;
			e.t = Math.max(e.t, this.minigameEndMs);
		}
	}
	// For players without explicit FREE events, infer from battle log and enqueue FREE events for them
	for (var i = 0; i < this.players.length; i++){ 
		if (hasFreeEvent[i])
			continue;
		let tFree = this.t;
		let pkm = this.players[i].getHead(); 
		for (var j = this.log.length - 1; j >= 0; j--){
			var e = this.log[j];
			if (e.index == i){
				if (e.name == EVENT.Damage){
					let move = new Move(e.value);
					tFree = e.t - move.dws + move.duration;
					if (this.battleMode == "pvp" && move.moveType == "charged"){
						tFree += Math.round(0.5 * Data.BattleSettings.minigameDurationMs);
					}
					if (pkm.role == "gd" || pkm.role == "rb"){
						tFree += 1500 + round(1000 * Math.random());
					}
				}else if (e.name == EVENT.Minigame || e.name == EVENT.Protect || e.name == EVENT.Nothing){
					tFree = e.t + Data.BattleSettings.minigameDurationMs;
				}else if (e.name == EVENT.Dodge){
					tFree = e.t + Data.BattleSettings.dodgeDurationMs;
				}
				break;
			}
		}
		tFree = Math.max(tFree, this.minigameEndMs);
		this.timeline.enqueue({
			name: (pkm.active ? EVENT.Free : EVENT.Enter), t: tFree, subject: pkm
		});
	}
	this.battle();
}

/**
	Get the alternative events of a given event, for interactive batte log.
	@param {Object} e The primary event.
	@return {Object[]} A list of all valid alternative events (the primary event excluded).
*/
World.prototype.getAlternativeEvents = function(e){
	var alternatives = [];
	var alternativePokemon = [];
	var alternativeMoves = [];
	for (let pkm of e.subject.party.pokemon){
		if (pkm.id != e.subject.id && pkm.isAlive()){
			alternativePokemon.push({
				t: e.t, name: (e.name == EVENT.Enter ? EVENT.Enter : EVENT.Switch), value: pkm.id, 
				style: "pokemon", text: pkm.label, icon: pkm.icon
			});
		}
	}
	let curMove = e.move || {dws: 0, energyDelta: 0};
	for (let altMove of [e.subject.fmove].concat(e.subject.cmoves)){
		if (altMove.name != curMove.name && e.subject.energy - curMove.energyDelta + altMove.energyDelta >= 0){
			var altDamageEvent = {
				t: e.t + altMove.dws - curMove.dws, name: EVENT.Damage, value: altMove.name,
				style: "move", text: altMove.label, icon: altMove.icon
			};
			if (this.battleMode == "pvp"){
				if (curMove.moveType == "charged" && altMove.moveType == "fast"){
					altDamageEvent.t -= Math.round(0.5 * Data.BattleSettings.minigameDurationMs);
				}else if (curMove.moveType == "fast" && altMove.moveType == "charged"){
					altDamageEvent.name = EVENT.Minigame;
				}
			}
			alternativeMoves.push(altDamageEvent);
		}
	}
	if (e.name == EVENT.Enter){
		alternatives = alternativePokemon;
	}else if (e.name == EVENT.Switch){
		alternatives = alternativePokemon.concat(alternativeMoves);
	}else if (e.name == EVENT.Damage){
		if (e.subject.master.switchingCooldownExpiration <= e.t && !(this.battleMode == "pvp" && e.move.moveType == "charged")){
			alternatives = alternativePokemon;
		}
		alternatives = alternatives.concat(alternativeMoves);
	}else if (e.name == EVENT.Dodge){
		alternatives = alternativeMoves;
	}else if (e.name == EVENT.Protect){
		alternatives.push({
			t: e.t, name: EVENT.Nothing, value: "",
			text: "No Shield"
		});
	}else if (e.name == EVENT.Nothing){
		if (e.subject.master.protectShieldLeft > 0){
			alternatives.push({
				t: e.t, name: EVENT.Protect, value: "",
				text: "Protect Shield"
			});
		}
	}
	return alternatives;
}

/**
	Log the simulator event.
	@param {Object} e Event to write.
*/
World.prototype.writeLog = function(e){
	var entry = {
		t: e.t, name: e.name, value: "", index: e.subject.master.index,
		cells: new Array(this.players.length)
	};
	var subjectCell = {
		alternatives: this.getAlternativeEvents(e)
	};
	if (e.name == EVENT.Enter){
		entry.value = e.subject.id;
		subjectCell.style = "pokemon";
		subjectCell.text = e.subject.label;
		subjectCell.icon = e.subject.icon;
	}else if (e.name == EVENT.Switch){
		entry.value = e.object.id;
		subjectCell.style = "pokemon";
		subjectCell.text = e.object.label;
		subjectCell.icon = e.object.icon;
	}else if (e.name == EVENT.Damage){
		entry.value = e.move.name;
		subjectCell.style = "move";
		subjectCell.text = e.move.label;
		subjectCell.icon = e.move.icon;
		for (let rival of e.subject.master.rivals){
			entry.cells[rival.index] = {
				text: (rival.getHead() || {HP: ""}).HP.toString()
			};
		}
	}else if (e.name == EVENT.Dodge){
		subjectCell.text = "Dodge";
	}else if (e.name == EVENT.Protect){
		subjectCell.text = "Protect Shield";
	}else if (e.name == EVENT.Nothing){
		subjectCell.text = "No Shield";
	}else{ // Ignore other events
		return;
	}
	entry.cells[entry.index] = subjectCell;
	this.log.push(entry);
}

/** 
	Get the battle results of the simulation.
	@return {{generalStat, playerStats, pokemonStats, battleLog}} Battle outcome metrics.
*/
World.prototype.getStatistics = function(){
	var general_stat = {};
	var player_stats = [];
	var pokemon_stats = [];
	general_stat['duration'] = this.battleDurationMs/1000;
	general_stat['battle_result'] = (this.isTeamDefeated("1") ? 1 : 0);
	let sumTDO = 0, sumMaxHP = 0;
	general_stat['numOfDeaths'] = 0;
	for (let player of this.players){
		let ts = player.getStatistics(general_stat['duration']);
		if (player.team == "0"){
			general_stat['numOfDeaths'] += ts['numOfDeaths'];
		}
		player_stats.push(ts);
		let playerStat = [];
		for (let party of player.parties){
			let partyStat = [];
			for (let pokemon of party.pokemon){
				partyStat.push(pokemon.getStatistics());
				if (player.team == "0"){
					sumTDO += pokemon.tdo;
				}else{
					sumMaxHP += pokemon.maxHP;
				}
			}
			playerStat.push(partyStat);
		}
		pokemon_stats.push(playerStat);
	}
	general_stat['tdo'] = sumTDO;
	general_stat['tdo_percent'] = sumTDO / sumMaxHP * 100;
	general_stat['dps'] = sumTDO / (this.battleDurationMs/1000);
	
	return {
		generalStat: general_stat,
		playerStats: player_stats,
		pokemonStats: pokemon_stats,
		battleLog: this.log
	};	
}


