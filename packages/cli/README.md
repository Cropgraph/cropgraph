# cropgraph (CLI)

Command-line interface for the CropGraph dataset. Twelve verbs, all offline,
no API keys.

## Install

```sh
npm install -g cropgraph
# or run on demand:
npx cropgraph zone --lat 48.118 --lng -123.43
```

## Commands

| Command | What |
|---------|------|
| `cropgraph zone` | USDA hardiness zone + frost dates from `--lat/--lng` or `--zip`. |
| `cropgraph planting` | What to plant this week, climate-aware. |
| `cropgraph crop <name>` | Full calendar entry for a single crop. |
| `cropgraph search <query>` | Search the 2000-crop calendar with zone/category filters. |
| `cropgraph companions <crop>` | Companion and antagonist plants for a crop. |
| `cropgraph check <c1> <c2>` | Check a single pairwise relationship. |
| `cropgraph plan <crops...>` | Evaluate a bed of 2-20 crops together. |
| `cropgraph rotation <crop>` | Rotation family + year-gap rule + recommended partners for a crop. |
| `cropgraph rotation-check <crops...>` | Validate a multi-year planting sequence. |
| `cropgraph succession <crop>` | Succession planting chain for a crop. Pass `--zone`/`--lat`/`--lng`/`--zip` for concrete dates. |
| `cropgraph pests <crop>` | Pests and diseases affecting a crop, with organic management and prevention. |
| `cropgraph pest-detail <pest>` | Full record for one pest or disease across every crop it touches. |
| `cropgraph config set-location` | Save a default location used when `--lat/--lng` are omitted. |

Every command supports `--json` for machine-readable output.

## Examples

```sh
# Hardiness zone from coordinates.
cropgraph zone --lat 48.118 --lng -123.4307

# What to plant this week in zone 8b, maritime climate.
cropgraph planting --zone 8b --climate maritime

# Companion table for tomato.
cropgraph companions tomato

# Sanity-check a bed.
cropgraph plan tomato basil marigold carrot

# Rotation rule for a single crop.
cropgraph rotation tomato

# Validate a 4-year plan in the same bed.
cropgraph rotation-check tomato bush-bean sweet-corn cabbage

# Succession chain for lettuce, with concrete dates for zone 8b maritime.
cropgraph succession lettuce --zone 8b --climate maritime

# Pests and diseases affecting tomato, sorted by severity.
cropgraph pests tomato

# Full record for one pest across every crop it touches.
cropgraph pest-detail cabbage-worm
```

## Configuration

Save a default location to skip `--lat/--lng` on every command:

```sh
cropgraph config set-location --lat 48.118 --lng -123.4307 --name "Port Angeles"
cropgraph zone   # uses the saved location
```

Stored at `~/.cropgraph/config.json` (override with `CROPGRAPH_CONFIG_DIR`).

## License

MIT.
