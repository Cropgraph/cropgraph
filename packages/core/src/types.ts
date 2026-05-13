// Shared types for @cropgraph/core. Garden planning, hardiness zones, frost
// dates. Kept narrow: every type here is consumed by one of the four helper
// modules (crop-calendar, companions, climate-types, usda-zones) or by the
// MCP / CLI thin wrappers downstream.

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface DateRange {
  from: string;
  to: string;
}

// ---------------------------------------------------------------------------
// USDA hardiness zones and frost-date table.
// ---------------------------------------------------------------------------

export interface ZoneInfo {
  /** USDA hardiness zone, e.g. "5a", "8b". 26 zones from "1a" to "13b". */
  zone: string;
  /** Numeric zone (1..13). */
  zoneNumber: number;
  /** "a" = colder half (-5°F), "b" = warmer half (+5°F). */
  subzone: "a" | "b";
  /** Average annual minimum winter temperature low end of band, °F. */
  minTempF: number;
  /** Average annual minimum winter temperature high end of band, °F. */
  maxTempF: number;
  /** Source of the zone determination. */
  source: "prism-2023";
  /** How the zone was found from the input. */
  resolvedFrom: "coords-nearest" | "zip-exact";
  /** Distance from query coords to nearest known ZIP centroid (km). Set
   *  only when resolvedFrom = "coords-nearest". */
  distanceKm?: number;
  /** The ZIP code used for the lookup (input ZIP for "zip-exact", nearest
   *  centroid for "coords-nearest"). */
  zip: string;
}

export interface FrostDates {
  /** Zone these dates apply to (e.g. "5a"). */
  zone: string;
  /** Mean last spring frost as MM-DD (e.g. "04-25"). */
  lastSpring: string;
  /** Mean first fall frost as MM-DD (e.g. "10-05"). */
  firstFall: string;
  /** Frost-free growing season length in days. */
  seasonDays: number;
}

// ---------------------------------------------------------------------------
// Crop calendar planting suggestions.
// ---------------------------------------------------------------------------

export type PlantSuggestionAction =
  /** Sow seed indoors and transplant out later. */
  | "start_indoors"
  /** Sow seed directly in the garden bed. */
  | "direct_sow"
  /** Move existing seedlings (yours or nursery) to the bed. */
  | "transplant"
  /** Tree/perennial, plant the dormant root or potted plant now. */
  | "plant_now";

export interface PlantSuggestion {
  slug: string;
  commonName: string;
  scientificName: string;
  category: string;
  action: PlantSuggestionAction;
  /** Window start (ISO date YYYY-MM-DD). */
  windowStart: string;
  /** Window end (ISO date YYYY-MM-DD). */
  windowEnd: string;
  daysToHarvest: { min: number; max: number };
  /** Approximate harvest start if planted on the window's first day. */
  expectedHarvestEarliest?: string;
  /** Crop calendar notes, short, gardener-facing. */
  notes?: string;
}

export interface GardenBriefing {
  zone: ZoneInfo;
  frostDates: FrostDates;
  /** Crops to plant in the briefing's date window, sorted by category then
   *  action then crop name. May be empty in deep winter / extreme zones. */
  plantNow: PlantSuggestion[];
  /** ISO date the plan was computed against (defaults to today). */
  asOf: string;
  /** Coarse climate type ("maritime", "arid", etc.) used to apply per-climate
   *  modifiers. Set when the consumer supplied or auto-resolved one. */
  climateType?:
    | "maritime"
    | "mediterranean"
    | "continental"
    | "humid_subtropical"
    | "arid"
    | "semi_arid";
}
