# CropGraph

Commercial agricultural intelligence. Curated data, MCP server, and CLI for
crop calendars, companion planting, crop rotation, succession planting, pest
and disease management, USDA hardiness zones, and climate classification.

- **Website:** https://cropgraph.com
- **API:** https://api.cropgraph.com (see [cropgraph-api](https://github.com/Cropgraph/cropgraph-api))

## Packages

| Package | What |
|---------|------|
| [`@cropgraph/core`](./packages/core) | Crop calendar (2,000 entries), 605 companion relationships, rotation families, succession chains, pest/disease associations, 120 growing degree day models, USDA zones, climate types. Pure TypeScript, offline. |
| [`@cropgraph/mcp`](./packages/mcp) | Model Context Protocol server (stdio). Fourteen garden-planning tools for AI agents. |
| [`cropgraph`](./packages/cli) | Command-line interface. Subcommands for zones, planting, crop lookup, companions, rotation, succession, pests, and pest-detail. |

## Quick start

### MCP server (Claude Desktop, Cursor, etc.)

```sh
npx @cropgraph/mcp
```

See [`packages/mcp/README.md`](./packages/mcp/README.md) for client config.

### CLI

```sh
npx cropgraph zone --lat 48.118 --lng -123.43
npx cropgraph companions tomato
npx cropgraph planting --zone 8b --climate maritime
npx cropgraph succession lettuce --zone 8b --climate maritime
npx cropgraph pests tomato
```

### Library

```sh
npm install @cropgraph/core
```

```ts
import {
  getHardinessZone,
  getCompanions,
  getPlantingPlan,
  getSuccessionPlan,
} from "@cropgraph/core";

getHardinessZone(48.118, -123.43);   // "8b"
getCompanions("tomato");             // 18 entries
getPlantingPlan({ zone: "8b", climateType: "maritime" });
getSuccessionPlan({ slug: "lettuce-leaf", zone, climateType: "maritime" });
```

## Data

| Asset | Count | Notes |
|-------|-------|-------|
| Crop calendar | 2,000 entries | Frost-anchored windows, climate modifiers for 6 climate types |
| Companion relationships | 605 | 510 beneficial, 95 antagonist, 12 mechanism categories |
| Growing degree days | 120 models | Cultivar-specific GDD ranges, base temperatures, NOAA Climate Normals harvest prediction |
| Rotation families | 12 | Nightshades, brassicas, cucurbits, alliums, legumes, umbellifers, grasses, amaranthaceae, composites, mints, malvaceae, miscellaneous. Every calendar slug mapped. |
| Succession chains | 33 | Greens, roots, legumes, brassicas, cucurbits, herbs, flowers, cover crops. Frost-anchored phases with per-climate notes. |
| Pest/disease associations | 158 | Crop-to-pest edges with diagnostic symptoms, organic management, prevention, and regions. OMRI-listed management only. |
| USDA hardiness zones | 40,283 ZIPs | PRISM 2023 + waldoj/frostline centroids, offline lookup |
| Climate classifier | 6 types | Maritime, mediterranean, continental, humid subtropical, arid, semi-arid |

Sources cited per-entry in the JSON fixtures under
[`packages/core/src/data`](./packages/core/src/data).

## License

MIT. Copyright (c) 2026 Andrew Christison.
