const http = require('http');
const jsonfile = require('jsonfile');

const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

const serve = serveStatic("./GoBattleSim");

const server = http.createServer(function(req, res) {
  const done = finalhandler(req, res);
  serve(req, res, done);
});

server.listen(8001);

const attacker = process.argv[2]
const defender = process.argv[3]

async function run(attacker, defender) {
  const gbs = require('./sim/gbs.js');
  return await gbs.run([attacker], defender);
}

(async () => {
  const result = await run(attacker, defender);
  jsonfile.writeFileSync(`${attacker}-${defender}-sim.json`, result);

  server.close()
})();
