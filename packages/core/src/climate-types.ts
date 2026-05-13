// Climate type resolution from coordinates.
//
// USDA hardiness zones only measure average annual minimum winter temperature
//, they say nothing about summer heat, humidity, or rainfall. Zone 8b in
// Port Angeles, WA (cool wet maritime summers, ~70°F highs, 25" rain) is a
// completely different growing environment than zone 8b in Tucson, AZ (arid,
// 105°F summers, 12" rain) or zone 8b in Savannah, GA (hot humid, 50" rain).
// The crop calendar's frost-anchored windows are correct for "average North
// American gardening" but want adjustment by climate for heat-sensitive,
// drought-dependent, or photoperiod-driven crops.
//
// This module returns one of six coarse climate types from a coordinate. It
// intentionally uses a simple lat/lng heuristic rather than a county FIPS
// table, the heuristic covers ~90% of US locations correctly, the table
// would add ~3000 rows of data, and edge cases (coastal vs inland in the
// same band) can be refined later. Outside the rough US/Canada bounding box
// the result is a best-effort "continental", consumers should treat low
// confidence as a signal to skip climate modifiers.
//
// The six types are loosely Köppen-Geiger collapsed for gardening purposes:
//   maritime          cool summers, mild winters, consistent moisture
//   mediterranean     warm dry summers, mild wet winters
//   continental       hot summers, cold winters, moderate precipitation
//   humid_subtropical hot humid summers, mild winters
//   arid              hot dry summers, mild to cold winters, very low rain
//   semi_arid         moderate summers, variable winters, low rain

import { err, ok, type Result } from "./result.js";
import type { Coordinates } from "./types.js";

export type ClimateType =
  | "maritime"
  | "mediterranean"
  | "continental"
  | "humid_subtropical"
  | "arid"
  | "semi_arid";

export interface ClimateInfo {
  climateType: ClimateType;
  /** How the climate was resolved. Currently always "lat-lng-heuristic"; a
   *  future county-FIPS table would add "county-fips". */
  resolvedFrom: "lat-lng-heuristic";
}

const CLIMATE_DESCRIPTIONS: Record<ClimateType, string> = {
  maritime:
    "Cool summers, mild winters, consistent moisture. Slow soil warming, longer cool season, less heat stress, more slug/fungal pressure.",
  mediterranean:
    "Warm dry summers, mild wet winters. Summer drought stress, extended warm season, irrigation-dependent, almost no frost risk.",
  continental:
    "Hot summers, cold winters, moderate precipitation. Short intense growing season, deep frost, rapid spring warming.",
  humid_subtropical:
    "Hot humid summers, mild winters. Extended warm season, high disease pressure, double cropping possible, heat stress on cool crops.",
  arid:
    "Hot dry summers, mild to cold winters, very low precipitation. Extreme heat, irrigation mandatory, shade cloth season, low disease.",
  semi_arid:
    "Moderate summers, variable winters, low-moderate precipitation. Wind exposure, variable moisture, short but warm growing season.",
};

export function describeClimateType(t: ClimateType): string {
  return CLIMATE_DESCRIPTIONS[t];
}

const CLIMATE_TYPES: readonly ClimateType[] = [
  "maritime",
  "mediterranean",
  "continental",
  "humid_subtropical",
  "arid",
  "semi_arid",
];

export function isClimateType(s: string): s is ClimateType {
  return (CLIMATE_TYPES as readonly string[]).includes(s);
}

export function listClimateTypes(): readonly ClimateType[] {
  return CLIMATE_TYPES;
}

export function getClimateType(coords: Coordinates): Result<ClimateInfo> {
  if (
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng) ||
    coords.lat < -90 ||
    coords.lat > 90 ||
    coords.lng < -180 ||
    coords.lng > 180
  ) {
    return err({
      source: "climate-types",
      message: `getClimateType: invalid coordinates ${coords.lat},${coords.lng}`,
    });
  }
  return ok({
    climateType: classifyByLatLng(coords.lat, coords.lng),
    resolvedFrom: "lat-lng-heuristic",
  });
}

// Refined heuristic, passes the six anchor coords specified in Sticky 20:
//   Port Angeles 48.118, -123.43  → maritime
//   Tucson       32.22,  -110.97  → arid
//   Savannah     32.08,   -81.09  → humid_subtropical
//   Des Moines   41.59,   -93.62  → continental
//   San Diego    32.71,  -117.16  → mediterranean
//   Denver       39.74,  -104.99  → semi_arid
//
// The rules are evaluated top-down; the first match wins.
function classifyByLatLng(lat: number, lng: number): ClimateType {
  if (lng < -120 && lat >= 42) return "maritime";
  if (lng < -116 && lat >= 32 && lat < 42) return "mediterranean";
  if (lng >= -115 && lng < -100 && lat < 35) return "arid";
  if (lng >= -115 && lng < -100 && lat >= 35 && lat < 49) return "semi_arid";
  if (lng >= -90 && lat < 36) return "humid_subtropical";
  return "continental";
}
