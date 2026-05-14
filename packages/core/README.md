# @cropgraph/core

Curated agricultural intelligence as a pure TypeScript library. No network
calls, no API keys, no runtime dependencies beyond Zod.

## What's in here

| Asset | Detail |
|-------|--------|
| Crop calendar | 2,000 entries: 643 vegetables, 449 fruits, 383 herbs, 194 flowers, 162 legumes, 96 cover crops, 75 roots. Frost-anchored planting windows with climate modifiers for 120 crops across six climate types (window shifts and climate-specific notes for maritime, mediterranean, continental, humid_subtropical, arid, semi_arid). Named cultivars across tomato, pepper, apple, grape, blueberry, raspberry, strawberry, pear, peach, plum, melon, watermelon, bean, pea, corn, squash, lettuce, carrot, onion, garlic. |
| Companion planting | 1,004 directed relationships: 510 beneficial, 95 antagonist, 12 mechanism categories (nitrogen_fixing, pest_repellent, trap_crop, ...). Deep coverage of fruit-tree guilds, cover-crop succession, native pollinator pairings, and cultivar-level disease antagonism. |
| Rotation families | 12 botanical families (nightshades, brassicas, cucurbits, alliums, legumes, umbellifers, grasses, amaranthaceae, composites, mints, malvaceae, miscellaneous). Every calendar slug is mapped. Year-gap, follow-with, and never-follow rules per family. |
| Succession chains | 102 time-sequenced planting chains: greens cycles, root cadences, legume relays, brassica spring/fall, cucurbit replacements, herb successions, cut-flower staggers, cover-crop relays. Frost-anchored phases with per-climate notes. |
| Pest/disease associations | 506 crop-to-pest edges with diagnostic symptoms, ordered organic management options, prevention practices, and regions of significance. OMRI-listed materials, biocontrols, and physical/cultural practices only. Curated against Cornell, UC IPM, UF/IFAS, Penn State, OSU, WSU, and Texas A&M Extension publications. |
| Beneficial insects | 200 entries across five functional categories: 62 predators (ladybugs, lacewings, ground beetles, mantises, assassin bugs, predatory mites, soldier bugs, spiders, hover fly larvae), 40 parasitoids (braconid wasps including the Cotesia hornworm specialist, Trichogramma egg parasitoids, Encarsia and Eretmocerus whitefly parasitoids, tachinid flies, ichneumon wasps), 50 pollinators (honey bees, native bumble bees, mason bees, leafcutter bees, sweat bees, mining bees, carpenter bees, squash bees, butterflies, sphinx moths), 29 decomposers (earthworms, dung beetles, pill bugs, millipedes, springtails, black soldier fly larva, soil mites), 22 microbial controls (entomopathogenic nematodes, Bt strains, Beauveria bassiana, Trichoderma, mycorrhizal fungi, milky spore). Composite pest intelligence layer joins beneficial, companion, and rotation data into a single "now what?" report with hand-authored wait-before-spraying notes for the top 40 pest slugs. Sourced from Xerces Society, Cornell, UC IPM, UF/IFAS, USDA-ARS, Penn State. |
| Growing degree days | 120 GDD models with cultivar-specific heat unit ranges for tomato, pepper, squash, melon, bean, corn, lettuce, root crops, and grains. Literature-grounded base temperatures and heat-unit ranges from Purdue, Cornell, UC Davis, USDA-ARS, OSU, and WSU Extension. Harvest-date estimator with NOAA Climate Normals 1991-2020 fallback (720 entries, 10 zone groups x 6 climate types x 12 months) so predictions work offline without a live weather API call. |
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

// Beneficial insects and composite pest intelligence.
getPestIntelligence("tomato-hornworm", "tomato");
// → { verdict: "foe", severity: "high", immediateAction: [...],
//     companionDeterrents: [...], beneficialPredators: [13 entries],
//     beneficialNote: "white cocoons = Cotesia braconid; wait, do not spray",
//     friendlyLookalikes: [...] }
getBeneficialIntelligence("seven-spotted-ladybug");
// → { verdict: "friend", attractedBy: [...], protects: [26 crops], ... }
getVerdictForInsect("tomato-hornworm");  // "foe"
listBeneficials("parasitoid");           // 40 entries

// Growing degree days and harvest prediction.
getGddModel("tomato");
// → { baseTemp: 50, gddToMaturity: { min: 1200, max: 1800 }, ... }

estimateHarvestDate({
  slug: "tomato",
  plantDate: "2026-05-15",
  zone: "8b",
  climateType: "maritime",
});
// → { ok: true, data: {
//     estimatedDate: "2026-09-02",   // earliest cultivar harvest
//     gddAccumulated: 1207,
//     confidence: "moderate",
//     monthlyAccumulation: [{ month: "May", gdd: 180 }, ...],
//     latestDate: "2026-10-14",      // full-season cultivar harvest
//     latestGddAccumulated: 1804,
//   } }

getClimateNormalTemps("8b", "maritime", 7);
// → { avgHigh: 78, avgLow: 58 }
```

## Data sources

Every entry cites a USDA Cooperative Extension publication or a
peer-reviewed source. See the per-entry `source` field in
[`src/data/crop-calendar.json`](./src/data/crop-calendar.json),
[`src/data/companions.json`](./src/data/companions.json),
[`src/data/rotation-families.json`](./src/data/rotation-families.json),
[`src/data/succession-chains.json`](./src/data/succession-chains.json),
[`src/data/pest-disease.json`](./src/data/pest-disease.json),
[`src/data/beneficial-insects.json`](./src/data/beneficial-insects.json),
[`src/data/pest-beneficial-map.json`](./src/data/pest-beneficial-map.json),
[`src/data/pest-companion-map.json`](./src/data/pest-companion-map.json),
and [`src/data/gdd-models.json`](./src/data/gdd-models.json),
and the file-level descriptions in the matching `*.schema.json` files for
the methodology rundown. Climate normals in
[`src/data/climate-normals.json`](./src/data/climate-normals.json) are derived
from NOAA Climate Normals 1991-2020 reference cities (Seattle, Sacramento,
Chicago, Atlanta, Phoenix, Denver) scaled to USDA zone groups.

## License

MIT.
