/* Populate.js */

function getPokemonType1FromString(S){
	var L = S.split(",");
	return L[0].trim().toLowerCase();
}

function getPokemonType2FromString(S){
	var L = S.split(",");
	if (L.length > 1)
		return L[1].trim().toLowerCase();
	else
		return "none";
}

function getMovesFromString(S){
	var res = [];
	var L = S.split(",");
	for (var i = 0; i < L.length; i++){
		var moveName = L[i].trim().toLowerCase();
		if (moveName.length > 0)
			res.push(moveName);
	}
	return res;
}

// Handle Exclusive moves
function handleExclusiveMoves(pokemonDataBase){
	for (var i = 0; i < pokemonDataBase.length; i++){
		var pkm = pokemonDataBase[i];
		pkm.fastMoves_exclusive = [];
		pkm.chargedMoves_exclusive = [];
		pkm.exclusiveMoves.forEach(function(move){
			if (get_fmove_index_by_name(move) >= 0)
				pkm.fastMoves_exclusive.push(move);
			else if (get_cmove_index_by_name(move) >= 0)
				pkm.chargedMoves_exclusive.push(move);
		});
		delete pkm.exclusiveMoves;
	}
}

function processUserPokeboxRawData(data){
	var box = [];
	for (var i = 0; i < data.length; i++){
		var pkmRaw = {
			index : get_species_index_by_name(data[i].species.toLowerCase()),
			box_index : i,
			species : data[i].species.toLowerCase(),
			cp: parseInt(data[i].cp),
			level: 0,
			stmiv: parseInt(data[i].sta),
			atkiv: parseInt(data[i].atk),
			defiv: parseInt(data[i].def),
			fmove: data[i].fast_move.toLowerCase(),
			fmove_index : get_fmove_index_by_name(data[i].fast_move.toLowerCase()),
			cmove: data[i].charge_move.toLowerCase(),
			cmove_index : get_cmove_index_by_name(data[i].charge_move.toLowerCase()),
			nickname : data[i].nickname
		};
		if (pkmRaw.index < 0 || pkmRaw.fmove_index < 0 || pkmRaw.cmove_index < 0){
			console.log("[Error in importing User Pokemon: species/moves not in database]");
			console.log(data[i]);
			continue;
		}
		copyAllInfo(pkmRaw, POKEMON_SPECIES_DATA[pkmRaw.index]);
		pkmRaw.level = calculateLevelByCP(pkmRaw, pkmRaw.cp);
		box.push(pkmRaw);
	}
	return box;
}

/* End of Helper Functions */


// TODO: Get CPM data: https://pokemongo.gamepress.gg/assets/data/cpm.json

// TODO: Get Type Advantages data

// Get raid boss list
function loadRaidBossList(oncomplete){
	oncomplete = oncomplete || function(){return;};
	
	$.ajax({ 
		url: 'https://pokemongo.gamepress.gg/sites/pokemongo/files/pogo-jsons/raid-boss-list.json?new', 
		dataType: 'json', 
		success: function(data){
			data.forEach(function(bossInfo){
				var parsedBossInfo = {
					name: createElement('div', bossInfo.title).children[0].innerText,
					tier: parseInt(createElement('div', bossInfo.tier).children[1].innerText),
					future: (bossInfo.future.toLowerCase() == 'on'),
					legacy: (bossInfo.legacy.toLowerCase() == 'on'),
					special: (bossInfo.special.toLowerCase() == 'on')
				};
				RAID_BOSS_LIST[parsedBossInfo.tier].push(parsedBossInfo);
			});
		},
		complete: function(jqXHR, textStatus){
			oncomplete();
		}
	});
}



// Read Pokemon Data
function loadLatestPokemonData(oncomplete){
	oncomplete = oncomplete || function(){return;};
	
	$.ajax({ 
		url: 'https://pokemongo.gamepress.gg/sites/pokemongo/files/pogo-jsons/pokemon-data-full.json?new', 
		dataType: 'json', 
		success: function(data){
			for(var i = 0; i < data.length; i++){
				var pkmData = {
					index: i,
					dex : parseInt(data[i].number),
					box_index : -1,
					name : data[i].title_1.toLowerCase(),
					pokeType1 : getPokemonType1FromString(data[i].field_pokemon_type),
					pokeType2 : getPokemonType2FromString(data[i].field_pokemon_type),
					baseAtk : parseInt(data[i].atk),
					baseDef : parseInt(data[i].def),
					baseStm : parseInt(data[i].sta),
					fastMoves : getMovesFromString(data[i].field_primary_moves),
					chargedMoves : getMovesFromString(data[i].field_secondary_moves),
					fastMoves_legacy : getMovesFromString(data[i].field_legacy_quick_moves),
					chargedMoves_legacy : getMovesFromString(data[i].field_legacy_charge_moves),
					exclusiveMoves : getMovesFromString(data[i].exclusive_moves),
					rating : parseFloat(data[i].rating) || 0,
					image: data[i].uri,
					icon: pokemon_icon_url_by_dex(data[i].number),
					label: toTitleCase(data[i].title_1)
				};
				POKEMON_SPECIES_DATA.push(pkmData);
			}
			
		},
		complete: function(jqXHR, textStatus){
			handleExclusiveMoves(POKEMON_SPECIES_DATA);
			handleExclusiveMoves(POKEMON_SPECIES_DATA_LOCAL);
			oncomplete();
		}
	});
}



// Read move data
function loadLatestMoveData(oncomplete){
	oncomplete = oncomplete || function(){return;};
	
	$.ajax({
		url: 'https://pokemongo.gamepress.gg/sites/pokemongo/files/pogo-jsons/move-data-full.json?new', 
		dataType: 'json', 
		success: function(data){
			var fmoveCount = 0, cmoveCount = 0;
			for(var i = 0; i < data.length; i++){
				var move = {
					name: data[i].title.toLowerCase(),
					power: parseInt(data[i].power),
					pokeType: data[i].move_type.toLowerCase(),
					dws: parseFloat(data[i].damage_window.split(' ')[0])*1000 || 0,
					duration: parseFloat(data[i].cooldown)*1000,
					label: toTitleCase(data[i].title),
					icon: poketype_icon_url_by_name(data[i].move_type)
				};
				if (data[i].move_category == "Fast Move"){
					move.index = fmoveCount++;
					move.moveType = 'f';
					move.energyDelta = Math.abs(parseInt(data[i].energy_gain));
					FAST_MOVE_DATA.push(move);
				}else{
					move.index = cmoveCount++;
					move.moveType = 'c';
					move.energyDelta = -Math.abs(parseInt(data[i].energy_cost));
					CHARGED_MOVE_DATA.push(move);
				}
			}
		},
		complete: function(jqXHR, textStatus){
			oncomplete();
		}
	});
}

// Read User Pokebox
function loadLatestPokeBox(userid, oncomplete){
	oncomplete = oncomplete || function(){return;};
	if (!(POKEMON_SPECIES_DATA_FETCHED && FAST_MOVE_DATA_FETCHED && CHARGED_MOVE_DATA_FETCHED)){
		return;
	}
	
	$.ajax({
		url: '/user-pokemon-json-list?new&uid_raw=' + userid,
		dataType: 'json',
		success: function(data){
			var importedBox = processUserPokeboxRawData(data);
			USERS_INFO.push({id: userid, box: importedBox});
			udpateUserTable();
			send_feedback("Successfully imported user " + userid + " with " + importedBox.length + " Pokemon", false, 'userEditForm-feedback');
			oncomplete();
		},
		error: function(){
			send_feedback("Failed to import user " + userid, false, 'userEditForm-feedback');
		}
	});
}

// Manually Modify Data
function manualModifyData(){
	var fmove_transform = FAST_MOVE_DATA[get_fmove_index_by_name('transform')];
	if (fmove_transform){
		fmove_transform.effect = {
			name : 'transform',
			remaining : 1
		};
	}
	
	var cmove_mega_drain = CHARGED_MOVE_DATA[get_cmove_index_by_name('mega drain')];
	if (cmove_mega_drain){
		cmove_mega_drain.effect = {
			name : 'hp_draining',
			multipliers: [0.5],
			remaining: -1
		};
	}
	
	var cmove_giga_drain = CHARGED_MOVE_DATA[get_cmove_index_by_name('giga drain')];
	if (cmove_giga_drain){
		cmove_giga_drain.effect = {
			name : 'hp_draining',
			multipliers: [0.5],
			remaining: -1
		};
	}
}



// when all principal data have been fetched
function handle_1(){
	if (POKEMON_SPECIES_DATA_FETCHED && FAST_MOVE_DATA_FETCHED && CHARGED_MOVE_DATA_FETCHED){
		manualModifyData();
		
		if (typeof userID2 != 'underfined' && userID2){
			loadLatestPokeBox(userID2, function(){
				udpateUserTable();
			});
		}
		
		if (window.location.href.includes('?')){
			writeUserInput(parseConfigFromUrl(window.location.href.split('?')[1]));
			main({maxJobSize: 10000});			
			document.getElementById('ui-mastersummarytable').scrollIntoView({behavior: "smooth", block: "center", inline: "center"});
		}
		
		if (localStorage && !localStorage.QUICK_START_WIZARD_NO_SHOW && !window.location.href.includes('?'))
			$( "#quickStartWizard" ).dialog( "open" );
	}
}


$(document).ready(function(){
	loadLatestPokemonData(function(){
		POKEMON_SPECIES_DATA_FETCHED = true;
		
		for (var i = 0; i < POKEMON_SPECIES_DATA_LOCAL.length; i++){
			POKEMON_SPECIES_DATA_LOCAL[i].index = POKEMON_SPECIES_DATA.length;
			POKEMON_SPECIES_DATA.push(POKEMON_SPECIES_DATA_LOCAL[i]);
		}
		if (localStorage){
			localStorage.POKEMON_SPECIES_DATA_LOCAL = JSON.stringify(POKEMON_SPECIES_DATA_LOCAL);
		}
		
		handle_1();
	});

	loadLatestMoveData(function(){ 
		FAST_MOVE_DATA_FETCHED = true; 
		CHARGED_MOVE_DATA_FETCHED = true;
		
		for (var i = 0; i < FAST_MOVE_DATA_LOCAL.length; i++){
			FAST_MOVE_DATA_LOCAL[i].index = FAST_MOVE_DATA.length;
			FAST_MOVE_DATA.push(FAST_MOVE_DATA_LOCAL[i]);
		}
		for (var i = 0; i < CHARGED_MOVE_DATA_LOCAL.length; i++){
			CHARGED_MOVE_DATA_LOCAL[i].index = CHARGED_MOVE_DATA.length;
			CHARGED_MOVE_DATA.push(CHARGED_MOVE_DATA_LOCAL[i]);
		}
		if (localStorage){
			localStorage.FAST_MOVE_DATA_LOCAL = JSON.stringify(FAST_MOVE_DATA_LOCAL);
			localStorage.CHARGED_MOVE_DATA_LOCAL = JSON.stringify(CHARGED_MOVE_DATA_LOCAL);
		}
		
		handle_1();
	});
	
	loadRaidBossList(function(){
		populateQuickStartWizardBossList('current');
	});
});