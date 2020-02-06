const http = require('http');

const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

const serve = serveStatic("./GoBattleSim");

const server = http.createServer(function(req, res) {
  const done = finalhandler(req, res);
  serve(req, res, done);
});

server.listen(80);

const puppeteer = require('puppeteer');

const Sim = require('./sim/sim.js');

(async () => {
  const browser = await puppeteer.launch();
  const page = await browser.newPage();
  await page.goto('http://localhost:80/GBS.html')

  await page.waitFor(100);

  const defender = 'Machamp';
  const attackers = ['Moltres', 'Mewtwo'];
  for(let i in attackers) {
    const attacker = attackers[i];
    const sim = new Sim(
      attackers[i],
      defender,
      page)
    const results = await sim.doSim();
    console.log(results)
  }

  await browser.close();
  server.close()
})();
