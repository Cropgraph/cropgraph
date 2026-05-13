# @cropgraph/core

Curated agricultural intelligence as a pure TypeScript library. No network
calls, no API keys, no runtime dependencies beyond Zod.

## What's in here

| Asset | Detail |
|-------|--------|
| Crop calendar | 1,000 entries: 319 vegetables, 186 herbs, 173 fruits, 163 flowers, 59 legumes, 55 cover crops, 45 roots. Frost-anchored planting windows with optional climate modifiers for six climate types. |
| Companion planting | 121 directed relationships: 88 beneficial, 33 antagonist, 12 mechanism categories (nitrogen_fixing, pest_repellent, trap_crop, ...). |
| USDA hardiness zones | 40,283 ZIP-code centroids from PRISM 2023 + waldoj/frostline, with offline lookup by coordinates or ZIP. Frost-date table by zone. |
| Climate types | Six-type classifier (maritime, mediterranean, continental, humid_subtropical, arid, semi_arid) from a coordinate-based heuristic. |

All datasets are validated against JSON Schemas at module load. A malformed
fixture breaks `import "@cropgraph/core"` immediately rather than at runtime.

## Install

```sh
npm install @cropgraph/core
```

## Usage

```ts
import {
  getHardinessZone,
  getClimateType,
  getPlantingPlan,
  findCrop,
  searchCrops,
  getCompanions,
  checkCompanionPair,
} from "@cropgraph/core";

// Zone lookup from coords.
const zone = getHardinessZone({ lat: 48.118, lng: -123.43 });
// → { ok: true, data: { zone: "8b", ... } }

// Climate classification from coords.
const climate = getClimateType({ lat: 48.118, lng: -123.43 });
// → { ok: true, data: { climateType: "maritime", ... } }

// Planting plan for a zone.
const plan = getPlantingPlan({ zone: "8b", climateType: "maritime" });
// → { ok: true, data: { plantNow: [ ... ] } }

// Crop lookup.
findCrop("tomato");
searchCrops("squash");

// Companion planting.
getCompanions("tomato");                // 18 entries for tomato
checkCompanionPair("tomato", "basil");  // beneficial
```

## Data sources

Every entry cites a USDA Cooperative Extension publication or a
peer-reviewed source. See the per-entry `source` field in
[`src/data/crop-calendar.json`](./src/data/crop-calendar.json) and
[`src/data/companions.json`](./src/data/companions.json), and the
file-level descriptions in the matching `*.schema.json` files for the
methodology rundown.

## License

MIT.
