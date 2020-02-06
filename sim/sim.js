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
    const results = {};
    const defenderMoves = this.generateMoveset(this.defenderData)
    for( let dFastMove of defenderMoves.fastMoveset) {
      for( let dChargeMove of defenderMoves.chargeMoveset) {
        console.log('Simulating ::', this.attacker, this.defender, dFastMove, dChargeMove)
        const input = this.getSimInput(dFastMove,dChargeMove);
        const sim = await this.page.evaluate(({input}) => {
          return GBS.request(input);
        }, {input});

        const simResults = {};

        sim.forEach( result => {
          const resultInput = result.input;
          const aFast = resultInput.players[0].parties[0].pokemon[0].fmove
          const aCharge = resultInput.players[0].parties[0].pokemon[0].cmove
          if(simResults[aFast] == undefined) simResults[aFast] = {};
          simResults[aFast][aCharge] = result.output.statistics
        });

        if(results[dFastMove.toLowerCase()] == undefined) results[dFastMove.toLowerCase()] = {};
        results[dFastMove.toLowerCase()][dChargeMove.toLowerCase()] = simResults;
      }
    }
    return results;
  }

  getSimInput(dFastMove, dChargeMove) {
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
              revive:false,
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
                  strategy:"ATTACKER_NO_DODGE",
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
              revive:false,
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

module.exports = Sim;
