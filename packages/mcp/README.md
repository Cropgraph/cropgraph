# @cropgraph/mcp

Model Context Protocol server for garden planning. Ten tools backed by the
curated CropGraph datasets (1,000 crops, 333 companion relationships,
12 rotation families, USDA hardiness zones, climate types). Runs over
stdio. No API key, no network.

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

Restart Claude Desktop. The ten tools will appear in the connector list.

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
| `search_plants` | Search the 1,000-crop calendar with optional zone/category filters. |
| `get_crops_for_zone` | All crops whose zone range includes the supplied USDA zone. |
| `get_companions` | Companion and antagonist plants for a crop with mechanisms, evidence strength, citations. |
| `check_companion_pair` | Look up a single beneficial/antagonist relationship between two crops. |
| `plan_bed_compatibility` | Evaluate 2-20 crops together: pairwise relationships + hub-antagonist warnings. |
| `get_rotation_advice` | Rotation family + year-gap rule for a crop, with recommended follow-with and never-follow crops. |
| `check_rotation_sequence` | Validate a multi-year sequence: flags rotation-gap violations and never-follow warnings. |

All tools are read-only and offline. Schemas describe each input field
in detail so an LLM can call them without external docs.

## Data sources

See [`@cropgraph/core`](../core) for the underlying datasets and citations.

## License

MIT.
