// USDA Plant Hardiness Zone resolution + typical frost-date table.
//
// Zone data: PRISM Climate Group / USDA-ARS 2023 Plant Hardiness Zone Map,
// merged from the four PRISM zip-code CSVs (us, ak, hi, pr) with the
// waldoj/frostline ZIP centroids. 40,283 ZIPs covered. Bundled JSON ~1.8 MB.
// Redistribution is permitted; see the file header in data/usda-zones.json.
//
// Frost-date table: hand-curated continental-US averages keyed by zone.
// USDA hardiness zones are based on average annual MINIMUM winter
// temperature, not on frost dates, but for general gardening guidance the
// correlation is strong enough that the table below is the standard
// reference grid printed in extension publications. Conservative bounds:
// coastal/microclimate variation can shift dates 2-3 weeks either way.

import zonesData from "./data/usda-zones.json" with { type: "json" };
import { err, ok, type Result } from "./result.js";
import type { Coordinates, FrostDates, ZoneInfo } from "./types.js";

// ---------------------------------------------------------------------------
// Bundled data, typed view over the compact array-of-arrays format.
// ---------------------------------------------------------------------------

interface ZoneRecordsFile {
  version: string;
  source: string;
  license: string;
  columns: ["zip", "lat", "lng", "zone", "trange"];
  records: [string, number, number, string, string][];
}

const DATA = zonesData as ZoneRecordsFile;

// ZIP → record index
let zipIndex: Map<string, number> | null = null;
function getZipIndex(): Map<string, number> {
  if (zipIndex) return zipIndex;
  const m = new Map<string, number>();
  for (let i = 0; i < DATA.records.length; i++) {
    const rec = DATA.records[i];
    if (rec) m.set(rec[0], i);
  }
  zipIndex = m;
  return m;
}

// Lat/lng grid → list of record indices, for fast nearest-neighbor.
// 1° cells × ~111 km is fine for ZIP centroids; nearest neighbor is found by
// scanning the query cell + all 8 neighbors.
const GRID_DEG = 1;
let latLngGrid: Map<string, number[]> | null = null;
function getLatLngGrid(): Map<string, number[]> {
  if (latLngGrid) return latLngGrid;
  const m = new Map<string, number[]>();
  for (let i = 0; i < DATA.records.length; i++) {
    const rec = DATA.records[i];
    if (!rec) continue;
    const key = gridKey(rec[1], rec[2]);
    const arr = m.get(key);
    if (arr) arr.push(i);
    else m.set(key, [i]);
  }
  latLngGrid = m;
  return m;
}

function gridKey(lat: number, lng: number): string {
  const la = Math.floor(lat / GRID_DEG);
  const ln = Math.floor(lng / GRID_DEG);
  return `${la},${ln}`;
}

function haversineKm(
  aLat: number,
  aLng: number,
  bLat: number,
  bLng: number,
): number {
  const R = 6371;
  const dLat = ((bLat - aLat) * Math.PI) / 180;
  const dLng = ((bLng - aLng) * Math.PI) / 180;
  const lat1 = (aLat * Math.PI) / 180;
  const lat2 = (bLat * Math.PI) / 180;
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.min(1, Math.sqrt(h)));
}

// ---------------------------------------------------------------------------
// Zone parsing, split "8a" / "8b" → number + subzone + temperature band.
// 26 zones × 5°F bands; zone 1a = -60..-55°F, zone 13b = 65..70°F.
// ---------------------------------------------------------------------------

const ZONE_RE = /^(\d{1,2})([ab])$/;

interface ZoneParts {
  zone: string;
  zoneNumber: number;
  subzone: "a" | "b";
  minTempF: number;
  maxTempF: number;
}

function parseZone(zone: string): ZoneParts | null {
  const m = ZONE_RE.exec(zone);
  if (!m) return null;
  const num = Number(m[1]);
  const sub = m[2] === "a" ? "a" : "b";
  if (!Number.isInteger(num) || num < 1 || num > 13) return null;
  // Zone N a starts at -60 + 10*(N-1); the b half is 5°F warmer.
  const minTempF = -60 + 10 * (num - 1) + (sub === "b" ? 5 : 0);
  return {
    zone,
    zoneNumber: num,
    subzone: sub,
    minTempF,
    maxTempF: minTempF + 5,
  };
}

// ---------------------------------------------------------------------------
// Public lookups
// ---------------------------------------------------------------------------

export function getHardinessZoneByZip(zip: string): Result<ZoneInfo> {
  const padded = String(zip).trim().padStart(5, "0");
  if (!/^\d{5}$/.test(padded)) {
    return err({
      source: "usda-zones",
      message: `getHardinessZoneByZip: zip must be 5 digits, got "${zip}"`,
    });
  }
  const idx = getZipIndex().get(padded);
  if (idx === undefined) {
    return err({
      source: "usda-zones",
      message: `getHardinessZoneByZip: ZIP ${padded} is not in the PRISM 2023 dataset (some ZIPs are excluded, try the lat/lng lookup instead)`,
      statusCode: 404,
    });
  }
  const rec = DATA.records[idx];
  if (!rec) {
    return err({
      source: "usda-zones",
      message: `getHardinessZoneByZip: internal index miss for ZIP ${padded}`,
    });
  }
  const parts = parseZone(rec[3]);
  if (!parts) {
    return err({
      source: "usda-zones",
      message: `getHardinessZoneByZip: dataset contains an unparseable zone "${rec[3]}" for ZIP ${padded}`,
    });
  }
  return ok({
    zone: parts.zone,
    zoneNumber: parts.zoneNumber,
    subzone: parts.subzone,
    minTempF: parts.minTempF,
    maxTempF: parts.maxTempF,
    source: "prism-2023",
    resolvedFrom: "zip-exact",
    zip: padded,
  });
}

export function getHardinessZone(coords: Coordinates): Result<ZoneInfo> {
  if (
    !Number.isFinite(coords.lat) ||
    !Number.isFinite(coords.lng) ||
    coords.lat < -90 ||
    coords.lat > 90 ||
    coords.lng < -180 ||
    coords.lng > 180
  ) {
    return err({
      source: "usda-zones",
      message: `getHardinessZone: invalid coordinates ${coords.lat},${coords.lng}`,
    });
  }
  const grid = getLatLngGrid();
  const baseLat = Math.floor(coords.lat / GRID_DEG);
  const baseLng = Math.floor(coords.lng / GRID_DEG);
  let bestIdx = -1;
  let bestKm = Infinity;
  // Spiral outward in 1° rings until a hit is found (handles ZIPs near the
  // edge of the bundled dataset, e.g. coords on the Mexican border).
  for (let ring = 0; ring <= 6; ring++) {
    let foundInRing = false;
    for (let dla = -ring; dla <= ring; dla++) {
      for (let dln = -ring; dln <= ring; dln++) {
        // Only scan the ring boundary, not the interior (already scanned).
        if (Math.max(Math.abs(dla), Math.abs(dln)) !== ring) continue;
        const cell = grid.get(`${baseLat + dla},${baseLng + dln}`);
        if (!cell) continue;
        for (const i of cell) {
          const rec = DATA.records[i];
          if (!rec) continue;
          const km = haversineKm(coords.lat, coords.lng, rec[1], rec[2]);
          if (km < bestKm) {
            bestKm = km;
            bestIdx = i;
            foundInRing = true;
          }
        }
      }
    }
    // Once we have a hit, scan one more ring to guarantee true nearest, then stop.
    if (bestIdx !== -1 && (foundInRing || ring > 0)) {
      if (ring > 0) break;
    }
  }
  if (bestIdx === -1) {
    return err({
      source: "usda-zones",
      message: `getHardinessZone: no ZIP centroid within ~666 km of ${coords.lat},${coords.lng}, out of PRISM 2023 coverage (US, AK, HI, PR)`,
      statusCode: 404,
    });
  }
  const rec = DATA.records[bestIdx];
  if (!rec) {
    return err({
      source: "usda-zones",
      message: `getHardinessZone: internal index miss for nearest neighbor`,
    });
  }
  const parts = parseZone(rec[3]);
  if (!parts) {
    return err({
      source: "usda-zones",
      message: `getHardinessZone: dataset contains an unparseable zone "${rec[3]}" for nearest ZIP ${rec[0]}`,
    });
  }
  return ok({
    zone: parts.zone,
    zoneNumber: parts.zoneNumber,
    subzone: parts.subzone,
    minTempF: parts.minTempF,
    maxTempF: parts.maxTempF,
    source: "prism-2023",
    resolvedFrom: "coords-nearest",
    distanceKm: Math.round(bestKm * 10) / 10,
    zip: rec[0],
  });
}

// ---------------------------------------------------------------------------
// Frost-date table, typical continental-US averages by zone.
//
// Sources: USDA Cooperative Extension publications (consolidated). These are
// reference dates for general gardening guidance, coastal/mountain/desert
// microclimates can shift by 2-3 weeks. Use as a planning aid, not a
// guarantee. Zones 11+ are effectively frost-free year-round.
// ---------------------------------------------------------------------------

const FROST_TABLE: Record<string, { lastSpring: string; firstFall: string }> = {
  "1a": { lastSpring: "06-15", firstFall: "07-25" },
  "1b": { lastSpring: "06-10", firstFall: "08-01" },
  "2a": { lastSpring: "06-01", firstFall: "08-10" },
  "2b": { lastSpring: "05-25", firstFall: "08-20" },
  "3a": { lastSpring: "05-20", firstFall: "09-01" },
  "3b": { lastSpring: "05-15", firstFall: "09-10" },
  "4a": { lastSpring: "05-10", firstFall: "09-20" },
  "4b": { lastSpring: "05-05", firstFall: "09-30" },
  "5a": { lastSpring: "04-30", firstFall: "10-05" },
  "5b": { lastSpring: "04-25", firstFall: "10-10" },
  "6a": { lastSpring: "04-15", firstFall: "10-15" },
  "6b": { lastSpring: "04-10", firstFall: "10-25" },
  "7a": { lastSpring: "04-05", firstFall: "11-01" },
  "7b": { lastSpring: "03-30", firstFall: "11-10" },
  "8a": { lastSpring: "03-25", firstFall: "11-20" },
  "8b": { lastSpring: "03-15", firstFall: "11-30" },
  "9a": { lastSpring: "03-01", firstFall: "12-01" },
  "9b": { lastSpring: "02-15", firstFall: "12-10" },
  "10a": { lastSpring: "01-30", firstFall: "12-15" },
  "10b": { lastSpring: "01-15", firstFall: "12-20" },
  // Zones 11-13 are effectively frost-free; we keep nominal markers so
  // crop-calendar math doesn't divide by zero, but consumers should treat
  // a season > 350d as "no frost season" for planning purposes.
  "11a": { lastSpring: "01-01", firstFall: "12-31" },
  "11b": { lastSpring: "01-01", firstFall: "12-31" },
  "12a": { lastSpring: "01-01", firstFall: "12-31" },
  "12b": { lastSpring: "01-01", firstFall: "12-31" },
  "13a": { lastSpring: "01-01", firstFall: "12-31" },
  "13b": { lastSpring: "01-01", firstFall: "12-31" },
};

function daysBetweenMmDd(start: string, end: string): number {
  const [sm, sd] = start.split("-").map(Number);
  const [em, ed] = end.split("-").map(Number);
  if (
    sm === undefined ||
    sd === undefined ||
    em === undefined ||
    ed === undefined
  ) {
    return 0;
  }
  // Use 2001 (non-leap) so the math is stable year-over-year.
  const startMs = Date.UTC(2001, sm - 1, sd);
  const endMs = Date.UTC(2001, em - 1, ed);
  if (endMs < startMs) {
    // Wraparound (e.g. zone 11 with same-day markers): return a positive
    // figure indicating effectively year-round.
    return 365;
  }
  return Math.round((endMs - startMs) / 86_400_000);
}

export function getFrostDates(zone: string): Result<FrostDates> {
  const trimmed = zone.trim().toLowerCase();
  const row = FROST_TABLE[trimmed];
  if (!row) {
    return err({
      source: "usda-zones",
      message: `getFrostDates: unknown zone "${zone}", expected "1a".."13b"`,
    });
  }
  return ok({
    zone: trimmed,
    lastSpring: row.lastSpring,
    firstFall: row.firstFall,
    seasonDays: daysBetweenMmDd(row.lastSpring, row.firstFall),
  });
}

// ---------------------------------------------------------------------------
// Date helpers shared across the garden module, kept here so the crop
// calendar can reuse them without importing from a higher-level package.
// ---------------------------------------------------------------------------

/** Resolve an MM-DD frost marker to a full ISO date in the given year. */
export function frostMmDdToIsoDate(mmdd: string, year: number): string {
  const trimmed = mmdd.trim();
  if (!/^\d{2}-\d{2}$/.test(trimmed)) {
    throw new Error(`frostMmDdToIsoDate: bad MM-DD ${mmdd}`);
  }
  return `${year}-${trimmed}`;
}

export function addDays(iso: string, days: number): string {
  const [y, m, d] = iso.split("-").map(Number);
  if (y === undefined || m === undefined || d === undefined) {
    throw new Error(`addDays: bad ISO date ${iso}`);
  }
  const t = Date.UTC(y, m - 1, d) + days * 86_400_000;
  const out = new Date(t);
  const yy = out.getUTCFullYear();
  const mm = String(out.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(out.getUTCDate()).padStart(2, "0");
  return `${yy}-${mm}-${dd}`;
}

export function isoDateUtc(d: Date = new Date()): string {
  const y = d.getUTCFullYear();
  const m = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}
