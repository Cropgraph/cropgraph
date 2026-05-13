# @cropgraph/core

Curated agricultural intelligence as a pure TypeScript library. No network
calls, no API keys, no runtime dependencies beyond Zod.

## What's in here

| Asset | Detail |
|-------|--------|
| Crop calendar | 1,000 entries: 319 vegetables, 186 herbs, 173 fruits, 163 flowers, 59 legumes, 55 cover crops, 45 roots. Frost-anchored planting windows with optional climate modifiers for six climate types. |
| Companion planting | 333 directed relationships: 281 beneficial, 52 antagonist, 11 mechanism categories (nitrogen_fixing, pest_repellent, trap_crop, ...). |
| Rotation families | 12 botanical families (nightshades, brassicas, cucurbits, alliums, legumes, umbellifers, grasses, amaranthaceae, composites, mints, malvaceae, miscellaneous). Every calendar slug is mapped. Year-gap, follow-with, and never-follow rules per family. |
| Succession chains | 33 time-sequenced planting chains: greens cycles, root cadences, legume relays, brassica spring/fall, cucurbit replacements, herb successions, cut-flower staggers, cover-crop relays. Frost-anchored phases with per-climate notes. |
| Pest/disease associations | 158 crop-to-pest edges with diagnostic symptoms, ordered organic management options, prevention practices, and regions of significance. OMRI-listed materials, biocontrols, and physical/cultural practices only. Curated against Cornell, UC IPM, UF/IFAS, Penn State, OSU, WSU, and Texas A&M Extension publications. |
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
  getRotationAdvice,
  checkRotationSequence,
  getSuccessionChain,
  getSuccessionPlan,
  getPestsByCrop,
  getPestDetail,
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
getCompanions("tomato");                // 33+ companion entries
checkCompanionPair("tomato", "basil");  // beneficial

// Rotation families.
getRotationAdvice("tomato");
// → { family: "nightshades", rotationYears: 3, followWith: [...], ... }
checkRotationSequence(["tomato", "bush-bean", "sweet-corn", "cabbage"]);
// → { ok: true, issues: [] }

// Succession planting.
getSuccessionChain("lettuce-leaf");
// → { slug: "lettuce-succession", chains: [phase 1, phase 2, phase 3], ... }
getSuccessionPlan({ slug: "lettuce-leaf", zone: zone.data, climateType: "maritime" });
// → { phases: [{ windowStart: "2026-02-15", sowingDates: [...] }, ...] }

// Pests and diseases.
getPestsByCrop("tomato");          // ~21 entries sorted by severity
getPestDetail("tomato-hornworm");  // every crop the pest affects + management
```

## Data sources

Every entry cites a USDA Cooperative Extension publication or a
peer-reviewed source. See the per-entry `source` field in
[`src/data/crop-calendar.json`](./src/data/crop-calendar.json),
[`src/data/companions.json`](./src/data/companions.json),
[`src/data/rotation-families.json`](./src/data/rotation-families.json),
[`src/data/succession-chains.json`](./src/data/succession-chains.json),
and [`src/data/pest-disease.json`](./src/data/pest-disease.json),
and the file-level descriptions in the matching `*.schema.json` files for
the methodology rundown.

## License

MIT.
