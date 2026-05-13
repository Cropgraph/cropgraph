# cropgraph (CLI)

Command-line interface for the CropGraph dataset. Seven verbs, all offline,
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
| `cropgraph search <query>` | Search the 1000-crop calendar with zone/category filters. |
| `cropgraph companions <crop>` | Companion and antagonist plants for a crop. |
| `cropgraph check <c1> <c2>` | Check a single pairwise relationship. |
| `cropgraph plan <crops...>` | Evaluate a bed of 2-20 crops together. |
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
