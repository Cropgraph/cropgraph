# CropGraph

Commercial agricultural intelligence. Curated data, MCP server, and CLI for
crop calendars, companion planting, USDA hardiness zones, and climate
classification.

- **Website:** https://cropgraph.com
- **API:** https://api.cropgraph.com (see [cropgraph-api](https://github.com/Cropgraph/cropgraph-api))

## Packages

| Package | What |
|---------|------|
| [`@cropgraph/core`](./packages/core) | Crop calendar (1,000 entries), companion relationships, USDA zones, climate types. Pure TypeScript, offline. |
| [`@cropgraph/mcp`](./packages/mcp) | Model Context Protocol server (stdio). Eight garden-planning tools for AI agents. |
| [`cropgraph`](./packages/cli) | Command-line interface. Seven subcommands for humans. |

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
```

### Library

```sh
npm install @cropgraph/core
```

```ts
import { getHardinessZone, getCompanions, getPlantingPlan } from "@cropgraph/core";

getHardinessZone(48.118, -123.43);   // "8b"
getCompanions("tomato");             // 18 entries
getPlantingPlan({ zone: "8b", climateType: "maritime" });
```

## Data

| Asset | Count | Notes |
|-------|-------|-------|
| Crop calendar | 1,000 entries | Frost-anchored windows, climate modifiers for 6 climate types |
| Companion relationships | 121 | 88 beneficial, 33 antagonist, 12 mechanism categories |
| USDA hardiness zones | 40,283 ZIPs | PRISM 2023 + waldoj/frostline centroids, offline lookup |
| Climate classifier | 6 types | Maritime, mediterranean, continental, humid subtropical, arid, semi-arid |

Sources cited per-entry in the JSON fixtures under
[`packages/core/src/data`](./packages/core/src/data).

## License

MIT. Copyright (c) 2026 Andrew Christison.
