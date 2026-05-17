# CropGraph Changelog

## 3.3.0 (2026-05-16)

Pest species catalog. Adds a slug-keyed scientific-name authority for every
pest and disease referenced from pest-disease.json. Internal naming layer,
purely additive; no breaking changes.

### New fixture: pest-species.json (243 entries)

One row per unique `pest` slug in pest-disease.json. Each entry carries
`slug`, `commonName`, `scientificName`, and `source`. Curated against GBIF
Backbone Taxonomy, UC IPM Online, Cornell Cooperative Extension, UF/IFAS
Featured Creatures, EPPO Global Database, ICTV Master Species List, USDA-ARS,
and Penn State Extension. Modern accepted binomials throughout. Pathovars
and formae speciales use the ISPP infrasubspecific convention (pv., f.sp.).
Generic slugs that cover multi-species complexes (cutworm, powdery-mildew,
damping-off, downy-mildew, flea-beetle, leaf-miner, root-knot-nematode,
spider-mite, stink-bug, wireworm, trichoderma, slug) are named at the
genus/family level (`Genus spp.`) with the dominant member species
enumerated in the per-entry source citation.

237 entries carry a `scientificName`. 6 physiological disorders (bitter-pit,
blossom-end-rot, catfacing, cilantro-bolt, prussic-acid-poisoning, tipburn)
carry `scientificName: null` with the disorder mechanism named in their
source citation.

### Loader: bidirectional cross-reference

`@cropgraph/core` now asserts at module load that every distinct `pest`
slug in pest-disease.json has a row in pest-species.json, and that every
pest-species row is referenced by at least one pest-disease entry. A
curation bug therefore breaks `import "@cropgraph/core"` immediately rather
than at runtime.

### New public surface (additive)

* `getPestSpecies(slug)` returns the species record for a pest or disease
  slug.
* `listPestSpecies()` returns all species records, sorted by slug.
* `getPestSpeciesMeta()` returns fixture meta including the
  with-scientific-name and disorder counts.
* New type `PestSpecies`.

### Why a separate fixture

The crop-association edges in pest-disease.json are per-(crop, pest), so
the same agent appears across many rows (`tomato-hornworm` against tomato,
pepper-sweet, etc.). Holding the scientific name on the edge would
duplicate it 4 to 8 times per pest and risk drift on future taxonomic
revisions. Holding it in a separate slug-keyed fixture is canonical
and DRY.

## 3.1.0 (2026-05-14)

Triple data depth release. Net dataset expansions on the three relationship
layers backed by the 5,006-crop calendar shipped in 3.0.0.

### Companions: 605 to 1,004 (+399)

New coverage: fruit-tree guilds (apple, pear, peach, cherry, plum, apricot,
nectarine, walnut, pecan) with daffodil, chive, comfrey, tansy, dill,
buckwheat, crimson-clover, yarrow, borage, onion, sweet-alyssum, calendula
guild members; cultivar-specific pairings (San Marzano + basil-genovese,
cherry-tomato + basil-thai, scab-resistant Liberty/Enterprise + white-clover,
Honeycrisp + mullein, Cosmic Crisp + sweet-alyssum, heritage cider apples
+ clover floor); medicinal herbs (tulsi, ashwagandha, echinacea, calendula,
valerian, feverfew, mullein, milk-thistle, nettle, chamomile, anise-hyssop);
mushroom cultivation (wine-cap stropharia in vegetable mulch, shiitake-log
near hazelnut/alder/sugar-maple, oyster blocks under shade-tolerant greens);
grain companions (wheat/oats/rye nurse cropping, rye allelopathy on small-
seeded crops, Three Sisters with flint and dent corn, pearl millet +
cowpea, sorghum + sunn hemp); native pollinator hubs (milkweed, aster,
liatris, salvia, bee-balm, monarda, anise-hyssop, agastache, scabiosa,
rudbeckia, coreopsis); permaculture dynamic accumulators (hairy-vetch
mulch, comfrey Bocking 14, nettle); forage rotations (alfalfa-wheat,
alfalfa-corn, sainfoin-sorghum, birdsfoot-trefoil + timothy); antagonist
depth (juglone separation distances for English walnut, black walnut,
pecan; fennel-herb expansion to all legumes; sunflower sesquiterpene
effects on potato/carrot/lettuce/wheat).

### Pest/disease: 158 to 506 (+348)

New coverage: fruit-tree (apple-scab, codling-moth, fire-blight,
cedar-apple-rust across multiple cultivars; apple-maggot, woolly aphid,
European sawfly, leafroller, sooty-blotch, flyspeck, bitter-rot; pear
fire-blight, psylla, scab, pear-slug; peach OFM, tree-borer, scale; cherry
fruit-fly, leaf-spot, brown-rot; plum-curculio across European/Japanese/
Italian/Santa Rosa; plum-pox-virus; apricot brown-rot, bacterial-spot);
berry (SWD across thin-skin berries; blueberry-maggot, mummy-berry,
stem-blight; raspberry cane-borer, crown-borer, anthracnose; blackberry
orange-rust; currant white-pine-blister-rust; elder-borer; gooseberry
powdery-mildew); grain (stem/leaf/stripe rust, fusarium head blight,
hessian-fly, wheat-aphid, oat crown-rust, barley covered-smut, rye ergot,
sorghum-midge, sugarcane-aphid, pearl-millet downy-mildew, quinoa
downy-mildew, amaranth tarnished-plant-bug); corn (rootworm, ECB, smut,
fall-armyworm); herb (basil downy-mildew, mint-rust, lavender root-rot
and AMV, oregano/sage/rosemary/thyme spider-mite, cilantro bolt, parsley
Septoria, dill parsleyworm); mushroom (trichoderma, cobweb-mold,
bacterial-blotch, ganoderma, fungus-gnat, slug on shiitake/oyster/
lions-mane/wine-cap/almond-agaricus/morel/reishi/maitake/turkey-tail/
chicken-of-the-woods); cover/forage (alfalfa-weevil, leafhopper,
verticillium; clover root-borer; vetch-bruchid; tall-fescue toxicosis;
sorghum-sudan prussic-acid); Asian veg + crucifer expansion (bok-choy,
napa, mizuna, tatsoi, kohlrabi, brussels-sprouts, kale-loop, collards,
mustard-greens, daikon/turnip/rutabaga cabbage-root-maggot, clubroot);
tropical/subtropical (papaya-ringspot-virus, papaya-fruit-fly,
guava-fruit-fly, pineapple mealybug, citrus-greening, citrus-canker,
Asian-citrus-psyllid, olive fruit-fly and knot, kiwi PSA);
cultivar-specific tomato/pepper (San Marzano + roma + italian-heirloom
+ cherry-tomato early/late blight, fusarium, BER, pepper-weevil,
broad-mite, western-flower-thrips, TSWV); flower and pollinator pests
(zinnia powdery-mildew, sunflower-moth and rust, calendula/borage/
bee-balm/echinacea/phacelia/yarrow/comfrey rust complex, medicinal-herb
aster-yellows).

### Succession: 32 to 102 (+70)

New coverage: vegetables (broccoli side-shoot succession, cabbage early/
mid/storage, onion sets/transplant/seed, potato early/mid/late, sweet-corn
2-week stagger, pea-bush-bean-pea relay, kohlrabi, bok-choy, napa, kale,
mustard-greens, swiss-chard, fennel-bulb, tatsoi, mizuna, watermelon,
cantaloupe, okra, eggplant, pepper, tomato, garlic+shallot, celery, leek,
fall daikon, rutabaga, brussels-sprouts, cauliflower-fall); herbs (cilantro
bolt cycle, parsley spring+fall, basil-genovese 3-week, thai-basil, dill,
summer-savory, mint, oregano-thyme, chive, lemon-balm, sage, lemon-verbena,
tulsi-rama); cut flowers (dahlia, sweet-pea spring+fall, sunflower 2-week
stagger, snapdragon, larkspur fall-sow, scabiosa, rudbeckia, phacelia,
ornamental amaranth, tithonia); cover-crop relays (oats-buckwheat-rye,
clover-tomato-vetch, pea-oats-summer-rye, vetch-corn-rye, rye-soybean-rye,
sorghum-sudan+cowpea-rye, buckwheat-brassica, daikon-mustard, sunn-hemp,
phacelia, sub-clover, lacy-phacelia, berseem-clover); fruit + perennial
(strawberry renovation, raspberry summer-fall overlap, blueberry cultivar
spread Duke-Bluecrop-Elliott, everbearing strawberry, rhubarb, asparagus).

### Quality

- 26 existing em dashes in companions.json replaced with appropriate
  punctuation. Zero em dashes across all three datasets.
- All slugs validated against crop-calendar.json at load time via the
  existing Zod parse guard.
- Duplicate detection across (crop, companion, mechanism) and (crop, pest)
  tuples; zero duplicates within and against existing entries.
- Strength grading honest: companions ship strong + moderate only;
  pest/disease severity calibrated for the home gardener.
- Sources cited per entry: Cornell, Penn State, OSU, WSU, UC IPM, UC ANR,
  UF/IFAS, Texas A&M, Michigan State, University of Minnesota, Iowa State,
  Kansas State Extensions; USDA-ARS, USDA-NRCS, USDA-APHIS; Xerces Society;
  SARE Cover Crops field guide; Stamets Mycelium Running; Cornell Small
  Farms Program; Jacke and Toensmeier Edible Forest Gardens v2; Floret
  Farm cut flower guide; Coleman The New Organic Grower; Cunningham Great
  Garden Companions; Riotte Carrots Love Tomatoes; ICAR-Indian Institute
  of Spices Research; ICRISAT; FAO.

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
