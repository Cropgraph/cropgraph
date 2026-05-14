# CropGraph Changelog

## 3.0.0 (2026-05-13)

Major version. Breaking schema change: crop calendar category enum extended
from 7 values to 14, adding `grain`, `mushroom`, `native`, `medicinal`,
`fiber`, `forage`, and `sprout`. Crop calendar tripled from 2,002 to 5,006
hand-curated entries (3,004 net new).

### Dataset expansion (2,002 to 5,006 entries)

Net new coverage:
- Named cultivars (~796): tomato, pepper (incl. Capsicum chinense / baccatum
  / pubescens / frutescens species), eggplant, tomatillo, ground-cherry,
  lettuce (butterhead/romaine/oak/batavian/crisphead/looseleaf/summer-crisp),
  bean (dry, lima, runner), squash (summer + winter), potato, onion
  (short-day/intermediate/long-day with latitude guidance), garlic (hardneck
  + softneck), corn (sweet/flour/flint/dent/popcorn/broom), melon, watermelon.
- Pome + stone fruit (~249): 67 net-new apple cultivars (heritage, modern
  disease-resistant, cold-hardy, cider, ornamental crabs), 31 pear (European
  + Asian + ussuriensis), sweet/sour cherry, European/Japanese plum,
  apricot, peach (Michigan bud-hardy, Zaiger whites, donuts), nectarine,
  quince. Pollination groups and chill-hour notes on every cultivar.
- Citrus + tropical/subtropical (~164): sweet oranges, mandarins/tangelos,
  lemons, limes (Persian, Key, Finger, Rangpur), grapefruit/pummelo,
  kumquats, specialty (Buddha's Hand, Etrog, Bergamot, Seville, Trifoliate),
  avocado, mango, guava, papaya, passionfruit (incl. Maypop native), lychee,
  longan, jackfruit, dragonfruit, starfruit, cherimoya, atemoya, sapote,
  date palm, coconut, tamarind, acerola, coffee (Bourbon, Typica, Caturra,
  Mundo Novo, SL28, Geisha), vanilla, cinnamon, jaboticaba, cacao.
- Berries + nuts + vine fruit (~255): 21 raspberry, 24 blackberry, 31
  blueberry (Northern/Southern Highbush, Rabbiteye, Half-high), gooseberry,
  currant, elderberry, lingonberry, honeyberry/haskap, goji, aronia,
  sea buckthorn, cranberry, walnut (English/Black/Heartnut), pecan,
  hazelnut (EFB-resistant), chestnut, almond, pistachio, macadamia,
  pine nut, kiwi (fuzzy/hardy/arctic), grape (American table, European wine,
  cold-hardy hybrids).
- Grains, pseudocereals, field crops (~264): 50 wheat (heritage + modern
  hard red/soft white/durum/einkorn/emmer/spelt/khorasan), oats, barley,
  rye, rice (Carolina Gold, Calrose, Koshihikari, Forbidden Black,
  Bhutanese Red, Basmati, Duborskian upland, Hmong sticky), buckwheat,
  quinoa, amaranth, millet (pearl, proso, foxtail, finger, browntop, kodo,
  little, barnyard, fonio), teff, sorghum (grain/syrup/broom), flax (fiber
  + seed), sunflower (oilseed + confection + cut), sesame, hemp (fiber +
  grain + CBD/CBG), hops.
- Medicinal herbs (~413): TCM (Codonopsis, He shou wu, Atractylodes,
  Bupleurum, dan shen, huang qin, ai ye, qing hao, ban xia, paeonia,
  epimedium, eucommia, cistanche), Ayurvedic (Bacopa, Vasaka, Guduchi,
  Vidanga, Pippali, Withania strain sources, neem, moringa), Western
  herbalism (hawthorn species, willow, linden, comfrey, mullein, vervain,
  blue cohosh, goldenseal cultivated, cramp bark), adaptogens (Panax
  species, rhodiola, schisandra, astragalus, jiaogulan, maca colors, suma),
  culinary-medicinal crossover (ginger variants, galangal, turmeric
  cultivars, cardamom, saffron, vanilla strains, cinnamon).
- Mushroom cultivation strains (~58): additional Pleurotus, Hericium,
  Grifola, Ganoderma (Red/Black/Yellow Reishi species), Cordyceps strains,
  Morchella species, mycorrhizal Cantharellus/Craterellus patches, Trametes
  strains, Inonotus obliquus (chaga), Fomitopsis officinalis (agarikon),
  Tuber truffle species, wood/cloud/snow ear.
- Permaculture / food forest (~200): nitrogen fixers (Elaeagnus, Robinia,
  Albizia, Gleditsia, Caragana, Alnus, Casuarina, Ceanothus), dynamic
  accumulators (Symphytum cultivars, Achillea variants), ground covers
  (Trifolium, Thymus serpyllum, Fragaria species, Ajuga, Sedum), hedgerow
  (Rosa rugosa, Crataegus, Ligustrum, Ilex, Viburnum, Cornus mas, Cotoneaster,
  Pyracantha, Fagus/Carpinus/Taxus hedges), edible perennials (Rheum,
  Asparagus, Helianthus tuberosus, Scorzonera, tree collards, Allium
  proliferum, Cynara, bamboo, Stachys affinis, Solanum quitoense, Typha),
  aquatic/bog (watercress, water chestnut, Oenanthe, lotus, Nymphaea,
  wasabi).
- Native edibles by region (~207): Pacific Northwest (huckleberries, Salal,
  Oregon grape, brambles, Saskatoon, camas, ramps, Pacific yew), Eastern
  woodland (pawpaw + persimmon cultivars, mayapple, groundnut, sassafras,
  acorns, chinquapin, butternut, hickories), Southwest (prickly pear,
  cholla, mesquite, agaves, tepary, yucca, saguaro, ocotillo), Great Plains
  (native plums, sand cherry, grapes, blazing star, soapweed, wild onions,
  bitterroot, mariposa lily), Southeast (muscadine cultivars, mayhaw,
  beautyberry, yaupon, smilax, loquat), Boreal (mountain ash, squashberry,
  spruce tips, paper birch sap, sugar maple cultivars).
- Sprouts + microgreens (~81): mizuna, pac choi, komatsuna, wild arugula,
  shiso, shungiku, purslane, borage, nasturtium, herbs, beet, chard, quinoa,
  sunflower, pea-shoot variants, lentils, chia, flax, sesame.
- Dye + fiber + basketry (~98): indigo species, madder species, marigold +
  coreopsis + safflower + achiote + alkanet, cotton species (Upland, Pima,
  Asiatic, Hawaiian), ramie, kenaf, jute, sisal, henequen, abaca, phormium,
  nettle fiber, milkweed fiber, papyrus, basket willow cultivars,
  sweetgrass.
- Forage + pasture (~219): grass forages (timothy, orchardgrass, smooth
  brome, tall fescue cultivars, wheatgrasses, sudangrass, pearl millet
  forage, eastern gamagrass, blue grama, buffalograss), legume forages
  (alfalfa cultivars, sweetclover, red/white/berseem/strawberry/Persian/
  arrowleaf clovers, lespedeza, sainfoin, birdsfoot trefoil, cicer milkvetch,
  vetch, lablab, cowpea, forage pea, forage soybean), brassica forages
  (Appin, Barkant, Pasja turnips, forage rape, forage kale, swede), browse
  (mulberry, willow, saltbush, quailbush, forage acacia), silage (BMR
  sorghum, silage sunflower, triticale, small-grain mixes).

### Schema changes (breaking)

- `category` enum extended to 14 values: existing 7 (`vegetable`, `herb`,
  `fruit`, `flower`, `cover-crop`, `root`, `legume`) plus 7 new (`grain`,
  `mushroom`, `native`, `medicinal`, `fiber`, `forage`, `sprout`).
- `version` field in crop-calendar.json bumped from `"1"` to `"2"`.
- 288 existing entries recategorized into the new taxonomy: 47 mushrooms
  out of `vegetable`, 46 grains out of `vegetable`/`cover-crop`, 65 sprouts
  out of `vegetable`, 36 forages out of `cover-crop`, 35 medicinals out of
  `herb`/`fruit`, 17 fibers out of `herb`/`cover-crop`, 42 natives out of
  `fruit`/`vegetable`/`herb`/`legume`/`root`.

### Sourcing policy

Tier-1 sources (USDA Cooperative Extension, USDA GRIN germplasm, Seed
Savers Exchange yearbook, USDA NRCS Plant Materials Centers, peer-reviewed
cultivar trials, university extension publications) for base species and
high-stakes perennials. Tier-2 sources (Fedco, Johnny's, Baker Creek /
Rare Seeds, Strictly Medicinal, Adaptive Seeds, Territorial, Sand Mountain
Herbs, Horizon Herbs, Richters, Mumm's Sprouting Seeds, True Leaf Market
microgreens, Field & Forest Products mushroom strains, Maiwa Handprints
dye, Long Thread Media fiber, Living Blue indigo, Fibershed network) for
cultivar-level descriptors. Every entry carries an explicit `source`
citation.

### Why it matters

Two thousand entries was already broad enough for general planting calendar
needs. Five thousand entries plus the 14-category taxonomy makes CropGraph
the largest structured planting calendar in existence and the only one
covering medicinal herbs (TCM, Ayurvedic, Western herbalism), mushroom
cultivation strains, regional native edibles, dye and fiber plants, pasture
forages, and sprouts/microgreens at variety-level depth alongside the
mainstream vegetable, fruit, grain, and herb cultivars. Every entry is
frost-anchored, zone-aware, source-cited, and validated against a Zod
schema at module load.

### Quality audit

- 0 duplicate slugs in 5,006 entries
- 0 em dashes in any string (audited file-wide; 287 pre-existing em dashes
  also stripped in this pass for brand consistency)
- 0 schema validation failures
- 0 slug regex violations
- All entries have `source`, `growingContext`, and at least one
  frost-anchored window
- `pnpm typecheck`, `pnpm build`, `pnpm test` all pass in `@cropgraph/core`,
  `@cropgraph/mcp`, and `cropgraph` (CLI)

### Downstream impact

- `@cropgraph/core` bumped to `3.0.0`. Consumers using the `CropCategory`
  type with exhaustive switches will need to handle the 7 new values.
- `@cropgraph/mcp` bumped to `3.0.0`. The `category` field in tool input
  schemas now accepts all 14 values.
- `cropgraph` CLI bumped to `3.0.0`. `--category` flag accepts all 14
  values.
- `cropgraph-api` (api.cropgraph.com) consumes `@cropgraph/core` via npm;
  bump that dependency to `^3.0.0` and update `VALID_CATEGORIES` in
  `api/router.ts` to the 14-value set after publish, then redeploy.
- `pondlog` consumes `@cropgraph/core` via npm; bump that dependency to
  `^3.0.0` after publish. No code changes required (no exhaustive switches
  on `CropCategory` in pondlog consumers).
