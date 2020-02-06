const GameMaster = require('./data/gamemaster.json');

const PokemonData = GameMaster.pokemon;
const MoveData = GameMaster.moves;

class Sim {
  constructor(attacker, aFastMove, aChargeMove, defender) {
    this.attacker = attacker
    this.defender = defender

    this.attackerData = (PokemonData.filter(obj => {
      return obj.speciesName === this.attacker;
    }))[0];
    this.defenderData = (PokemonData.filter(obj => {
      return obj.speciesName === this.defender;
    }))[0];

    this.aFastMove = (MoveData.filter(obj => {
      return obj.moveId === aFastMove;
    }))[0].name

    this.aChargeMove = (MoveData.filter(obj => {
      return obj.moveId === aChargeMove;
    }))[0].name
  }

  getSimInput() {
    const simInput = {
      battleMode:"raid",
      timelimit:180000,
      weather:"EXTREME",
      backgroundDPS:0,
      numSims:1,
      aggregation:"enum",
      players:[
        {
          label:[],
          friend:"none",
          team:"1",
          cloneMultiplier:0,
          parties:[
            {
              label:[],
              revive:!1,
              name:"",
              enterDelay:0,
              pokemon:[
                {
                  label:[],
                  name:this.attacker,
                  role:"a",
                  copies:6,
                  level:"40",
                  stmiv:"15",
                  atkiv:"15",
                  defiv:"15",
                  cp:"",
                  raidTier:"1",
                  fmove:this.aFastMove,
                  strategy:"ATTACKER_NO_DODGE",
                  cmove:this.aChargeMove,
                  cmove2:this.aChargeMove
                }
              ]
            }
          ]
        },
        {
          label:[],
          friend:"none",
          team:"0",
          cloneMultiplier:0,
          parties:[
            {
              label:[],
              revive:!1,
              name:"",
              enterDelay:0,
              pokemon:[
                {
                  label:[],
                  name:this.defender,
                  role:"rb",
                  copies:1,
                  level:"",
                  stmiv:"",
                  atkiv:"",
                  defiv:"",
                  cp:"",
                  raidTier:"3",
                  fmove:"Bullet Punch",
                  strategy:"DEFENDER",
                  cmove:"Heavy Slam",
                  cmove2:"Heavy Slam"
                }
              ]
            }
          ]
        }
      ]
    };
    return simInput;
  }
}

module.exports = Sim;