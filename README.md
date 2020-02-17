# GoBattleSimNode
🎮 Pokemon GO Raid simulator CLI interface based on GoBattleSim, powered by Node.js 

## Setup

`yarn setup`

## Usage

Running `sim` allows you to sim all Pokemon currently available in Pokemon GO, with all move combinations, against a target raid boss. This will dump a *LARGE* .json output of all sim results versus every combination of defender moves, sorted by defender's fast/charged moves, and most effective counter in order based on TDO (total damage output over a single battle).

`yarn sim <POKEMON NAME>`

The .json produced by this command follows the format below:

```json
{
    "Ponyta": {
        "ember": {
            "fire blast": [
                {
                    "dps": 41.286755690304744,
                    "duration": 89.714,
                    "numDeaths": 2,
                    "tdo": 3704,
                    "tdoPercent": 102.8888888888889,
                    "win": 1,
                    "fast": "smack down",
                    "charge": "rock slide",
                    "attacker": "rampardos"
                },
                {
                    "dps": 38.13276557882361,
                    "duration": 94.407,
                    "numDeaths": 2,
                    "tdo": 3600,
                    "tdoPercent": 100,
                    "win": 1,
                    "fast": "mud shot",
                    "charge": "earth power",
                    "attacker": "landorus (therian forme)"
                },
                ...
```
