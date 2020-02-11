const http = require('http');
const jsonfile = require('jsonfile');

const finalhandler = require('finalhandler');
const serveStatic = require('serve-static');

const serve = serveStatic("./GoBattleSim");

const PokemonData = require('./sim/data/pokemonlist');

const server = http.createServer(function(req, res) {
  const done = finalhandler(req, res);
  serve(req, res, done);
});

server.listen(8001);

// const attackers = process.argv[2]
const attackers = [];
for(let i in PokemonData) {
  let speciesName = PokemonData[i]
  attackers.push(speciesName);
}
console.log(attackers)

const defender = process.argv[2]

async function run(attacker, defender) {
  const gbs = require('./sim/gbs.js');
  return await gbs.run(attackers, defender);
}

(async () => {
  const result = await run(attackers, defender);
  jsonfile.writeFileSync(`${defender}-raid-sim.json`, result);

  console.log(`Wrote output to ${defender}-raid-sim.json`);
  server.close()
})();
