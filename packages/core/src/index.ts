// Public surface of @cropgraph/core. Re-exports are grouped by domain so
// downstream packages (the MCP server, the CLI, the cropgraph-api repo, and
// Pondlog's garden briefing) can import only what they need.

// Result<T> and shared types.
export * from "./result.js";
export * from "./types.js";

// USDA hardiness zones, frost-date table, and small date utilities used by
// the planting plan.
export * from "./usda-zones.js";

// Climate classification (six-type heuristic from coords).
export * from "./climate-types.js";

// Crop calendar: 1,000 entries with frost-anchored planting windows and
// climate modifiers.
export * from "./crop-calendar.js";

// Companion relationships: directed edges, mechanism categories, evidence
// strengths.
export * from "./companions.js";

// Rotation families: botanical-family partition of every calendar slug with
// year-gap, follow-with, and never-follow rules per family.
export * from "./rotation.js";

// Succession chains: time-sequenced planting cadence per crop, with concrete
// dated plans resolved against a zone's frost dates.
export * from "./succession.js";

// Pest and disease associations: crop-to-pest edges with diagnostic symptoms,
// organic management options, prevention, and regions of significance.
export * from "./pest-disease.js";
