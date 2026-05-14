# @cropgraph/mcp

Model Context Protocol server for garden planning. Eighteen tools backed by
the curated CropGraph datasets (5,006 crops across 14 categories, 1,004
companion relationships, 12 rotation families, 102 succession planting
chains, 506 pest/disease associations, 200 beneficial insects with composite
pest intelligence, 120 growing degree day models, USDA hardiness zones,
climate types). Runs over stdio. No API key, no network.

## Install / run

```sh
npx @cropgraph/mcp
```

The server reads MCP JSON-RPC over stdio and exits on EOF.

## Claude Desktop

Add to `~/Library/Application Support/Claude/claude_desktop_config.json`
(macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows):

```json
{
  "mcpServers": {
    "cropgraph": {
      "command": "npx",
      "args": ["-y", "@cropgraph/mcp"]
    }
  }
}
```

Restart Claude Desktop. The eighteen tools will appear in the connector list.

## Cursor

Add to `~/.cursor/mcp.json`:

```json
{
  "mcpServers": {
    "cropgraph": {
      "command": "npx",
      "args": ["-y", "@cropgraph/mcp"]
    }
  }
}
```

## Tools

| Tool | What it does |
|------|--------------|
| `get_hardiness_zone` | USDA hardiness zone + frost dates from lat/lng or ZIP. |
| `get_planting_plan` | What to plant in a date window for a given zone (climate-aware). |
| `get_crop_details` | Full crop calendar entry by slug, common name, or scientific name. |
| `search_plants` | Search the 5,006-crop calendar with optional zone/category filters across 14 categories. |
| `get_crops_for_zone` | All crops whose zone range includes the supplied USDA zone. |
| `get_companions` | Companion and antagonist plants for a crop with mechanisms, evidence strength, citations. |
| `check_companion_pair` | Look up a single beneficial/antagonist relationship between two crops. |
| `plan_bed_compatibility` | Evaluate 2-20 crops together: pairwise relationships + hub-antagonist warnings. |
| `get_rotation_advice` | Rotation family + year-gap rule for a crop, with recommended follow-with and never-follow crops. |
| `check_rotation_sequence` | Validate a multi-year sequence: flags rotation-gap violations and never-follow warnings. |
| `get_succession_chain` | Succession planting chain for a crop: phases with sow method, cadence, and frost-relative window. |
| `get_succession_plan` | Same chain resolved to concrete ISO dates for a zone (climate-aware, with per-phase sowing date lists). |
| `get_crop_pests` | Pests and diseases for a crop, sorted by severity, with diagnostic symptoms, organic management, prevention, regions, and citations. |
| `get_pest_detail` | Full record for one pest or disease across every crop it touches. |
| `get_pest_intelligence` | Composite "now what?" report after a pest is identified: severity verdict, immediate action, companion deterrents, beneficial predators with wait-before-spraying guidance, friend-or-foe lookalikes, crop-specific symptoms when plant is supplied. |
| `get_beneficial_insect` | Full detail for one beneficial insect or microbial control: identification, garden role, habitat needs, attractor plants, crops protected via prey relationships. |
| `list_beneficials` | Browse the 200-entry beneficial insects catalog or filter by category (predator, parasitoid, pollinator, decomposer, microbial-control). |
| `get_verdict` | Friend-or-foe classifier for any insect slug. Returns friend, foe, nuisance, cosmetic, or neutral. |

All tools are read-only and offline. Schemas describe each input field
in detail so an LLM can call them without external docs.

## Data sources

See [`@cropgraph/core`](../core) for the underlying datasets and citations.

## License

MIT.
