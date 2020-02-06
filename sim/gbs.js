const puppeteer = require('puppeteer');

const Sim = require('./sim.js');

module.exports.run = (attackers, defender) => {
  return (async () => {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('http://localhost:8001/GBS.html')

    await page.waitFor(100);

    const results = {};
    results[defender] = {};
    for(let i in attackers) {
      const attacker = attackers[i];
      const sim = new Sim(
        attackers[i],
        defender,
        page)
      results[defender][attacker] = await sim.doSim();
    }

    await browser.close();

    return results;
  })();
}


