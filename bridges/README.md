# fall-euaiact · estate bridges

> ◊·κ=1 · interop modules · zero deps

This folder contains bridges connecting `fall-euaiact` to sibling estate tools.

## Two bridges shipped

### 1 · FallBrief bridge (`fallbrief.js`)

[FallBrief](https://github.com/sjgant80-hub/fallbrief) is Simon's sovereign UK legal research tool with 9 agents and a weave-based argument schema.

This bridge:
- Adds a new agent: **BRUSSELS** (EU AI law specialist)
- Maps EU AI Act classifications into FallBrief weave queries
- Generates 4 EUAIA-prefixed weaves (one per risk tier)
- Emits `euaia_classification` events on `fall-signal` BroadcastChannel

#### Usage in fall-euaiact:
```js
import { emitToFallBrief } from './bridges/fallbrief.js';

const bc = new BroadcastChannel('fall-signal');
emitToFallBrief(bc, classifyResult, systemDescription);
// → FallBrief picks it up and routes to BRUSSELS agent
```

#### Usage in FallBrief (drop into agent registry):
```js
import { brusselsAgentDef } from 'fall-euaiact/bridges/fallbrief';

const BRUSSELS = brusselsAgentDef();
// register alongside MAGNA, LIBERTY, CROWN, EQUITY, HEARTH, GUILD, ADMIRALTY, PROCEDURE
```

### 2 · Legalmon bridge (`legalmon.js`)

[Legalmon](https://github.com/teslasolar/Legalmon) is Thomas's Pokemon-style court case battle replay engine.

This bridge:
- Translates a classification verdict into a Legalmon battle config
- Maps tier → arena · HP · moves · ability · referee quote
- Articles cited become "moves" with type/power scaling
- Emits `euaia_battle_request` events on `fall-signal` BroadcastChannel

#### The map:
| Tier | Arena | You | Opponent | Reward |
|---|---|---|---|---|
| **Prohibited** | Brussels Tribunal · Article 5 Forbidden Zone | Shadow type · HP 30 | EU AI Office Enforcement Squad · HP 200 | None · re-scope |
| **High** | Annex III Battle Stadium | High-Risk type · HP 100 | High-Risk Reviewer · HP 150 | CE marking |
| **Limited** | Article 50 Disclosure Beach | Transparent · HP 120 | Light Touch Inspector · HP 60 | Compliance |
| **Minimal** | Minimal Risk Park | Normal · HP 200 | Voluntary Volunteer · HP 30 | No AI Act obligations |

#### Usage:
```js
import { emitToLegalmon, toLegalmonBattle } from './bridges/legalmon.js';

const bc = new BroadcastChannel('fall-signal');
emitToLegalmon(bc, classifyResult, 'My CV Scorer');
// → Legalmon picks it up and renders the battle

// Or grab the config directly:
const battle = toLegalmonBattle(classifyResult, 'My CV Scorer');
// → JSON shape Legalmon's render engine consumes
```

## The fall-signal event contract

Both bridges follow the same envelope:

```js
{
  type: 'fall_signal',
  source: 'fall-euaiact',
  target: 'fallbrief' | 'legalmon',
  kind: 'euaia_classification' | 'euaia_battle_request',
  payload: { ... bridge-specific ... },
  ts: '2026-06-03T...'
}
```

Any estate tool listening on `BroadcastChannel('fall-signal')` can subscribe by filtering on `source === 'fall-euaiact'`.

## How the demo HTML uses these

Open https://sjgant80-hub.github.io/fall-euaiact/ · run a classification · click:

- **"Open in FallBrief"** → broadcasts `euaia_classification`
- **"Battle in Legalmon"** → broadcasts `euaia_battle_request`

If the corresponding tool is open in another tab on the same origin, it receives the event and acts on it. Sovereign mesh in action.

## Status

| Bridge | Status | Tested |
|---|---|---|
| `fallbrief.js` | ✓ shipped · awaits FallBrief BRUSSELS agent registration | structurally |
| `legalmon.js` | ✓ shipped · awaits Thomas's Legalmon to subscribe to the event kind | structurally |
| Future · audiofabric? | could visualise enforcement-action soundscape | planned |
| Future · fall-substrate? | research-only output flows through here for compliance-aware specs | planned |

The bridges are unilateral · fall-euaiact emits and consumers subscribe. No coordination needed before deployment. When FallBrief or Legalmon add their listeners, the connection lights up.

◊·κ=1 · classify · bridge · mesh
