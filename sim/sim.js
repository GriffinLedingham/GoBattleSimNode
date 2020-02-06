const GameMaster = require('./data/gamemaster.json');

const PokemonData = GameMaster.pokemon;
const MoveData = GameMaster.moves;

class Sim {
  constructor(attacker, defender, page) {
    this.page = page

    this.attacker = attacker
    this.defender = defender

    this.attackerData = (PokemonData.filter(obj => {
      return obj.speciesName === this.attacker;
    }))[0];
    this.defenderData = (PokemonData.filter(obj => {
      return obj.speciesName === this.defender;
    }))[0];
  }

  generateMoveset(roleData) {
    const fastMoveset = [];
    const chargeMoveset = [];

    for(let j in roleData.fastMoves) {
      fastMoveset.push((MoveData.filter(obj => {
        return obj.moveId === roleData.fastMoves[j];
      }))[0].name)
    }
    for(let j in roleData.chargedMoves) {
      chargeMoveset.push((MoveData.filter(obj => {
        return obj.moveId === roleData.chargedMoves[j];
      }))[0].name)
    }

    return { fastMoveset, chargeMoveset };
  }

  async doSim() {
    const results = [];
    const attackerMoves = this.generateMoveset(this.attackerData)
    const defenderMoves = this.generateMoveset(this.defenderData)
    for( let aFastMove of attackerMoves.fastMoveset) {
      for( let aChargeMove of attackerMoves.chargeMoveset) {
        for( let dFastMove of defenderMoves.fastMoveset) {
          for( let dChargeMove of defenderMoves.chargeMoveset) {
            console.log('Simulating ::', this.attacker, aFastMove, aChargeMove, this.defender, dFastMove, dChargeMove)
            const input = this.getSimInput(aFastMove,aChargeMove,dFastMove,dChargeMove);
            const sim = await this.page.evaluate(({input}) => {
              return GBS.request(input);
            }, {input});
            results.push(sim);
          }
        }
      }
    }
    return results;
  }

  getSimInput(aFastMove, aChargeMove, dFastMove, dChargeMove) {
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
                  fmove:dFastMove,
                  strategy:"DEFENDER",
                  cmove:dChargeMove,
                  cmove2:dChargeMove
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

async function asyncForEach(array, callback) {
  for (let index = 0; index < array.length; index++) {
    await callback(array[index], index, array);
  }
}

module.exports = Sim;