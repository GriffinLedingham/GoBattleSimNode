const puppeteer = require('puppeteer');

const Sim = require('./sim.js');

module.exports.run = (attackers, defender) => {
  return (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8001/GBS.html')

    await page.waitFor(100);
    const results = {};
    const dpsResults = {};
    results[defender] = {};
    for(let i in attackers) {
      console.log(`Simulating... ${attackers[i]}`)
      const attackerName = attackers[i];
      const sim = new Sim(
        attackerName,
        defender,
        page)
      const simResult = await sim.doSim();
      for(let j in simResult) {
        const dFastMove = simResult[j];
        for(let k in simResult[j]) {
          const dChargeMove = simResult[j][k];
          for(let l in simResult[j][k]) {
            const attacker = simResult[j][k][l];
            if(results[defender][j] == undefined) results[defender][j] = {};
            if(results[defender][j][k] == undefined) results[defender][j][k] = [];
            // results[defender][j][k][l] = attacker;
            for(let aFast in attacker) {
              for(let aCharge in attacker[aFast]) {
                const simPayload = attacker[aFast][aCharge];
                simPayload.fast = aFast;
                simPayload.charge = aCharge;
                simPayload.attacker = attackerName.toLowerCase();
                results[defender][j][k].push(simPayload);
              }
            }
          }
        }
      }
    }
    for(let defenderName in results) {
      for(let dFast in results[defenderName]) {
        for(let dCharge in results[defenderName][dFast]) {
          results[defenderName][dFast][dCharge].sort((a, b) => (a.dps < b.dps) ? 1 : -1)
        }
      }
    }

    await browser.close();

    return results;
  })();
}


