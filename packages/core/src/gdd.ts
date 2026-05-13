// Growing Degree Day models, the fifth predictive layer of CropGraph. Maps
// crops to literature-grounded heat unit ranges and projects an estimated
// harvest date from a planting date plus daily temperatures. When live
// temperatures are not available, monthly NOAA Climate Normals 1991-2020
// (aggregated by USDA hardiness zone group and climate type) substitute for
// the missing weather call. Data lives in `data/gdd-models.json` and
// `data/climate-normals.json`. Every `slug` is cross-referenced against
// crop-calendar.json at parse time so a curation bug breaks the import of
// `@cropgraph/core` immediately rather than at runtime.
//
// Why GDD beats "days to harvest" for date-anchored prediction:
//   - "Days to harvest" assumes the crop's variety reaches maturity in N
//     calendar days regardless of where it is planted. A tomato in maritime
//     zone 8b accumulates heat slower than a tomato in continental zone 8b,
//     so the same variety harvests a month apart.
//   - Daily GDD captures actual heat accumulation:
//        gdd_day = max(0, (high + low) / 2 - baseTemp)
//     and crops mature when accumulated GDD reaches their literature range.
//
// Evidence grounding: Purdue University Extension reference tables, Cornell
// Cooperative Extension, UC Davis Vegetable Research and Information Center,
// USDA-ARS publications, OSU Extension, WSU Extension. Base temperatures and
// GDD ranges represent the well-established midpoint of published cultivar
// tables.

import { z } from "zod";
import { isClimateType, type ClimateType } from "./climate-types.js";
import climateNormalsRaw from "./data/climate-normals.json" with { type: "json" };
import gddRaw from "./data/gdd-models.json" with { type: "json" };
import { listCrops } from "./crop-calendar.js";
import { err, ok, type Result } from "./result.js";
import { addDays } from "./usda-zones.js";

// ---------------------------------------------------------------------------
// GDD model fixture
// ---------------------------------------------------------------------------

const GddEntrySchema = z.object({
  slug: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,40}$/, "slug must be a kebab-case slug"),
  baseTemp: z.number().int().min(30).max(70),
  gddToMaturity: z
    .object({
      min: z.number().int().min(100).max(5000),
      max: z.number().int().min(100).max(5000),
    })
    .refine((g) => g.max >= g.min, {
      message: "gddToMaturity.max must be >= min",
    }),
  notes: z.string().min(1).max(400).optional(),
});

export type GddModel = z.infer<typeof GddEntrySchema>;

const GddFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(GddEntrySchema),
});

interface GddFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: GddModel[];
}

let GDD_DATA: GddFile | null = null;
let GDD_BY_SLUG: Map<string, GddModel> | null = null;

function loadGdd(): GddFile {
  if (GDD_DATA) return GDD_DATA;
  const parsed = GddFileSchema.safeParse(gddRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `gdd-models.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  const cropSlugs = new Set(listCrops().map((e) => e.slug));
  const seen = new Set<string>();
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const e = parsed.data.entries[i]!;
    if (!cropSlugs.has(e.slug)) {
      throw new Error(
        `gdd-models.json entry[${i}] references unknown crop slug "${e.slug}"; must exist in crop-calendar.json`,
      );
    }
    if (seen.has(e.slug)) {
      throw new Error(
        `gdd-models.json has duplicate slug "${e.slug}"`,
      );
    }
    seen.add(e.slug);
  }
  GDD_DATA = parsed.data;
  return GDD_DATA;
}

function gddIndex(): Map<string, GddModel> {
  if (GDD_BY_SLUG) return GDD_BY_SLUG;
  const idx = new Map<string, GddModel>();
  for (const e of loadGdd().entries) idx.set(e.slug, e);
  GDD_BY_SLUG = idx;
  return idx;
}

export interface GddMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalModels: number;
}

export function getGddMeta(): GddMeta {
  const d = loadGdd();
  const out: GddMeta = {
    version: d.version,
    source: d.source,
    license: d.license,
    totalModels: d.entries.length,
  };
  if (d.lastUpdated !== undefined) out.lastUpdated = d.lastUpdated;
  return out;
}

/** GDD model for a crop. Returns null when the slug has no model in the
 *  fixture; not every crop in the calendar has a literature-backed GDD range. */
export function getGddModel(slug: string): GddModel | null {
  return gddIndex().get(slug) ?? null;
}

/** All GDD models in file order. */
export function listGddModels(): GddModel[] {
  return loadGdd().entries.slice();
}

// ---------------------------------------------------------------------------
// Climate normals fixture (NOAA-derived monthly highs/lows by zone group +
// climate type). 720 entries: 10 zone groups x 6 climates x 12 months.
// ---------------------------------------------------------------------------

const ClimateTempSchema = z.object({
  h: z.number().int().min(-60).max(130),
  l: z.number().int().min(-80).max(120),
});

const ClimateNormalsFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  zoneGroups: z.array(z.string().min(1).max(8)).min(1),
  climateTypes: z.array(z.string().min(1).max(40)).min(1),
  temps: z.record(ClimateTempSchema),
});

interface ClimateNormalsFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  zoneGroups: string[];
  climateTypes: string[];
  temps: Record<string, { h: number; l: number }>;
}

let NORMALS_DATA: ClimateNormalsFile | null = null;

function loadNormals(): ClimateNormalsFile {
  if (NORMALS_DATA) return NORMALS_DATA;
  const parsed = ClimateNormalsFileSchema.safeParse(climateNormalsRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `climate-normals.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  NORMALS_DATA = parsed.data;
  return NORMALS_DATA;
}

/** Map a USDA hardiness zone (e.g. "5a", "8b", "12", "11") to one of the 10
 *  zone-group keys used in the climate-normals fixture. Zones 1 and 2 share
 *  the "z1" bucket; zones 11..13 share the "z11p" bucket. */
function zoneToGroup(zone: string): string | null {
  const m = /^(\d{1,2})/.exec(zone.trim());
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  if (!Number.isInteger(n) || n < 1 || n > 13) return null;
  if (n <= 2) return "z1";
  if (n >= 11) return "z11p";
  return `z${n}`;
}

/** Average monthly high/low °F for a hardiness zone, climate type, and month
 *  (1..12). Returns null when any input is unrecognized. */
export function getClimateNormalTemps(
  zone: string,
  climateType: ClimateType,
  month: number,
): { avgHigh: number; avgLow: number } | null {
  if (!isClimateType(climateType)) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  const group = zoneToGroup(zone);
  if (!group) return null;
  const key = `${group}.${climateType}.${String(month).padStart(2, "0")}`;
  const cell = loadNormals().temps[key];
  if (!cell) return null;
  return { avgHigh: cell.h, avgLow: cell.l };
}

// ---------------------------------------------------------------------------
// Harvest-date estimation
// ---------------------------------------------------------------------------

const MAX_GROWTH_DAYS = 365;

export interface EstimateHarvestDateParams {
  slug: string;
  /** ISO date YYYY-MM-DD the seed/transplant goes in the ground. */
  plantDate: string;
  /** Manual average daily high °F. When supplied with avgDailyLow, confidence
   *  is "high" and climate normals are ignored. */
  avgDailyHigh?: number;
  /** Manual average daily low °F. */
  avgDailyLow?: number;
  /** Override the model's baseTemp. Rarely needed; supplied for cultivar
   *  experimentation. */
  baseTemp?: number;
  /** USDA hardiness zone for climate-normal lookup when temps are not
   *  supplied. */
  zone?: string;
  /** Climate type for climate-normal lookup when temps are not supplied. */
  climateType?: ClimateType;
}

export interface MonthlyGddAccumulation {
  /** Month abbreviation (Jan, Feb, ... Dec). */
  month: string;
  /** GDD accumulated within this month at the daily rate. */
  gdd: number;
}

export interface EstimateHarvestDateResult {
  /** Estimated harvest date when GDD hits the model's `min` threshold. */
  estimatedDate: string;
  /** GDD accumulated up to estimatedDate. Should equal model.gddToMaturity.min
   *  unless the season's heat budget is insufficient (then equal to the total
   *  GDD accumulated over MAX_GROWTH_DAYS). */
  gddAccumulated: number;
  /** "high" when daily temps were supplied directly. "moderate" when derived
   *  from climate normals. "low" when the season cannot reach the minimum
   *  GDD threshold within MAX_GROWTH_DAYS. */
  confidence: "high" | "moderate" | "low";
  /** Per-month GDD accumulation along the growing window. */
  monthlyAccumulation: MonthlyGddAccumulation[];
  /** Latest-cultivar harvest estimate (GDD hits the model's `max` threshold). */
  latestDate: string;
  /** GDD accumulated up to latestDate; same conditions as `gddAccumulated`. */
  latestGddAccumulated: number;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

const MONTH_ABBREVIATIONS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

/** Estimate the harvest date for a crop planted on `plantDate`, using either
 *  manual daily temperature averages (high confidence) or NOAA Climate Normals
 *  by zone+climate (moderate confidence). Walks calendar days from plantDate,
 *  accumulating daily GDD until the model's minimum threshold is reached. */
export function estimateHarvestDate(
  params: EstimateHarvestDateParams,
): Result<EstimateHarvestDateResult> {
  const model = getGddModel(params.slug);
  if (!model) {
    return err({
      source: "gdd",
      message: `estimateHarvestDate: no GDD model for "${params.slug}"`,
      statusCode: 404,
    });
  }
  if (!ISO_DATE_RE.test(params.plantDate)) {
    return err({
      source: "gdd",
      message: `estimateHarvestDate: bad plantDate "${params.plantDate}", expected YYYY-MM-DD`,
    });
  }
  const baseTemp = params.baseTemp ?? model.baseTemp;
  if (!Number.isFinite(baseTemp)) {
    return err({
      source: "gdd",
      message: `estimateHarvestDate: baseTemp must be a number, got ${params.baseTemp}`,
    });
  }

  // Decide where daily temps come from.
  const manualHigh = params.avgDailyHigh;
  const manualLow = params.avgDailyLow;
  const hasManual =
    Number.isFinite(manualHigh) && Number.isFinite(manualLow);
  let confidence: "high" | "moderate" | "low";
  let normals: ClimateNormalsFile | null = null;
  if (hasManual) {
    confidence = "high";
  } else {
    if (!params.zone || !params.climateType) {
      return err({
        source: "gdd",
        message:
          "estimateHarvestDate: supply (avgDailyHigh + avgDailyLow) or (zone + climateType)",
      });
    }
    if (!isClimateType(params.climateType)) {
      return err({
        source: "gdd",
        message: `estimateHarvestDate: unknown climateType "${params.climateType}"`,
      });
    }
    normals = loadNormals();
    confidence = "moderate";
  }

  // Walk days from plantDate, accumulating GDD until we hit min, recording
  // monthly subtotals along the way. Keep going to the max threshold to also
  // return a "latest" estimate for the response.
  let acc = 0;
  let minHitDate: string | null = null;
  let minHitGdd = 0;
  let maxHitDate: string | null = null;
  let maxHitGdd = 0;
  let lastDate = params.plantDate;
  let lastGdd = 0;
  const monthly: { key: string; gdd: number }[] = [];

  let currentMonthKey: string | null = null;
  let currentMonthSubtotal = 0;

  for (let dayOffset = 0; dayOffset < MAX_GROWTH_DAYS; dayOffset++) {
    const dateIso = addDays(params.plantDate, dayOffset);
    const month = Number(dateIso.slice(5, 7));
    const year = Number(dateIso.slice(0, 4));
    if (
      !Number.isInteger(month) ||
      month < 1 ||
      month > 12 ||
      !Number.isInteger(year)
    ) {
      break;
    }
    let dayHigh: number;
    let dayLow: number;
    if (hasManual) {
      dayHigh = manualHigh as number;
      dayLow = manualLow as number;
    } else {
      const cell = getClimateNormalTemps(
        params.zone as string,
        params.climateType as ClimateType,
        month,
      );
      if (!cell) {
        return err({
          source: "gdd",
          message: `estimateHarvestDate: no climate-normal cell for zone "${params.zone}", climate "${params.climateType}", month ${month}`,
        });
      }
      dayHigh = cell.avgHigh;
      dayLow = cell.avgLow;
    }
    const dayGdd = Math.max(0, (dayHigh + dayLow) / 2 - baseTemp);
    acc += dayGdd;

    const monthKey = `${year}-${String(month).padStart(2, "0")}`;
    if (currentMonthKey === null) currentMonthKey = monthKey;
    if (monthKey !== currentMonthKey) {
      monthly.push({ key: currentMonthKey, gdd: Math.round(currentMonthSubtotal) });
      currentMonthKey = monthKey;
      currentMonthSubtotal = 0;
    }
    currentMonthSubtotal += dayGdd;

    if (minHitDate === null && acc >= model.gddToMaturity.min) {
      minHitDate = dateIso;
      minHitGdd = Math.round(acc);
    }
    if (maxHitDate === null && acc >= model.gddToMaturity.max) {
      maxHitDate = dateIso;
      maxHitGdd = Math.round(acc);
    }
    lastDate = dateIso;
    lastGdd = Math.round(acc);

    if (minHitDate !== null && maxHitDate !== null) break;
  }
  // Flush trailing partial month subtotal.
  if (currentMonthKey !== null) {
    monthly.push({ key: currentMonthKey, gdd: Math.round(currentMonthSubtotal) });
  }

  // Insufficient heat budget. Surface what was accumulated so the caller can
  // tell the user "outside this crop's climate envelope at this date".
  if (minHitDate === null) {
    return ok({
      estimatedDate: lastDate,
      gddAccumulated: lastGdd,
      confidence: "low" as const,
      monthlyAccumulation: monthly.map((m) => ({
        month: formatMonth(m.key),
        gdd: m.gdd,
      })),
      latestDate: lastDate,
      latestGddAccumulated: lastGdd,
    });
  }

  return ok({
    estimatedDate: minHitDate,
    gddAccumulated: minHitGdd,
    confidence,
    monthlyAccumulation: monthly.map((m) => ({
      month: formatMonth(m.key),
      gdd: m.gdd,
    })),
    latestDate: maxHitDate ?? lastDate,
    latestGddAccumulated: maxHitDate !== null ? maxHitGdd : lastGdd,
  });
}

function formatMonth(monthKey: string): string {
  // "2026-05" -> "May" when only one year is in the window, "May 2026" when
  // the window crosses a year boundary. We default to abbreviation only; the
  // caller already has the planting date for context.
  const m = Number(monthKey.slice(5, 7));
  if (!Number.isInteger(m) || m < 1 || m > 12) return monthKey;
  return MONTH_ABBREVIATIONS[m - 1]!;
}
