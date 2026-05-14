// Crop calendar, hand-curated planting windows for ~1000 food crops, herbs,
// companion flowers, and cover crops. Source: USDA Cooperative Extension
// publications (consolidated). Each entry has multiple frost-anchored
// windows (start_indoors, direct_sow, transplant, plant_now) so a single
// crop covers spring + fall + perennial planting actions.
//
// Data lives in `data/crop-calendar.json`. Schema: `crop-calendar.schema.json`.
// Community contributions are welcome. JSON Schema validation runs at first
// load to catch malformed entries.

import { z } from "zod";
import type { ClimateType } from "./climate-types.js";
import calendarRaw from "./data/crop-calendar.json" with { type: "json" };
import { err, ok, type Result } from "./result.js";
import type {
  FrostDates,
  PlantSuggestion,
  PlantSuggestionAction,
  ZoneInfo,
} from "./types.js";
import {
  addDays,
  frostMmDdToIsoDate,
  getFrostDates,
  isoDateUtc,
} from "./usda-zones.js";

// ---------------------------------------------------------------------------
// Zod schemas, parsed at module load. Throws fast on a malformed JSON file.
// ---------------------------------------------------------------------------

const CategorySchema = z.enum([
  "vegetable",
  "herb",
  "fruit",
  "flower",
  "cover-crop",
  "root",
  "legume",
  "grain",
  "mushroom",
  "native",
  "medicinal",
  "fiber",
  "forage",
  "sprout",
]);
export type CropCategory = z.infer<typeof CategorySchema>;

const SeasonSchema = z.enum(["cool", "warm", "perennial", "biennial"]);
export type CropSeason = z.infer<typeof SeasonSchema>;

const GrowingContextSchema = z.enum([
  "outdoor",
  "indoor",
  "both",
  "greenhouse",
]);
export type CropGrowingContext = z.infer<typeof GrowingContextSchema>;

const ActionSchema = z.enum([
  "start_indoors",
  "direct_sow",
  "transplant",
  "plant_now",
]);

const AnchorSchema = z.enum(["last_spring", "first_fall"]);
export type CropAnchor = z.infer<typeof AnchorSchema>;

const WindowSchema = z
  .object({
    action: ActionSchema,
    anchor: AnchorSchema,
    fromFrostDays: z.number().int().min(-180).max(180),
    toFrostDays: z.number().int().min(-180).max(180),
    notes: z.string().max(200).optional(),
  })
  .refine((w) => w.toFrostDays >= w.fromFrostDays, {
    message: "toFrostDays must be >= fromFrostDays",
  });

export type CropWindow = z.infer<typeof WindowSchema>;

const ClimateTypeSchema = z.enum([
  "maritime",
  "mediterranean",
  "continental",
  "humid_subtropical",
  "arid",
  "semi_arid",
]);

const ClimateModifierSchema = z.object({
  windowShifts: z
    .object({
      start_indoors: z.number().int().min(-12).max(12).optional(),
      direct_sow: z.number().int().min(-12).max(12).optional(),
      transplant: z.number().int().min(-12).max(12).optional(),
    })
    .optional(),
  notes: z.string().min(1).max(300).optional(),
});

export type ClimateModifier = z.infer<typeof ClimateModifierSchema>;

const ClimateModifiersSchema = z
  .object({
    maritime: ClimateModifierSchema.optional(),
    mediterranean: ClimateModifierSchema.optional(),
    continental: ClimateModifierSchema.optional(),
    humid_subtropical: ClimateModifierSchema.optional(),
    arid: ClimateModifierSchema.optional(),
    semi_arid: ClimateModifierSchema.optional(),
  })
  .optional();

const EntrySchema = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z][a-z0-9-]{1,40}$/,
      "slug must be kebab-case starting with a letter",
    ),
  commonName: z.string().min(1).max(60),
  scientificName: z.string().min(1).max(80),
  category: CategorySchema,
  season: SeasonSchema,
  growingContext: GrowingContextSchema.optional(),
  daysToHarvest: z.object({
    min: z.number().int().min(1).max(3650),
    max: z.number().int().min(1).max(3650),
  }),
  minSoilTempF: z.number().int().min(20).max(100).nullable().optional(),
  zoneRange: z.object({
    min: z.number().int().min(1).max(13),
    max: z.number().int().min(1).max(13),
  }),
  windows: z.array(WindowSchema).min(1),
  notes: z.string().max(400).optional(),
  aliases: z.array(z.string().min(1).max(60)).optional(),
  source: z.string().optional(),
  climateModifiers: ClimateModifiersSchema,
});

export type CropEntry = z.infer<typeof EntrySchema>;

const CalendarFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(EntrySchema),
});

interface CropCalendarFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: CropEntry[];
}

let CALENDAR: CropCalendarFile | null = null;

function loadCalendar(): CropCalendarFile {
  if (CALENDAR) return CALENDAR;
  const parsed = CalendarFileSchema.safeParse(calendarRaw);
  if (!parsed.success) {
    // Surface the first error inline; the rest are findable via the test suite.
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `crop-calendar.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  CALENDAR = parsed.data;
  return CALENDAR;
}

// ---------------------------------------------------------------------------
// Lookups
// ---------------------------------------------------------------------------

export interface CropCalendarMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalEntries: number;
}

export function getCropCalendarMeta(): CropCalendarMeta {
  const cal = loadCalendar();
  const meta: CropCalendarMeta = {
    version: cal.version,
    source: cal.source,
    license: cal.license,
    totalEntries: cal.entries.length,
  };
  if (cal.lastUpdated !== undefined) meta.lastUpdated = cal.lastUpdated;
  return meta;
}

export interface ListCropsParams {
  category?: CropCategory;
  season?: CropSeason;
  zone?: string;
}

/** List all crops, optionally filtered. Returns entries in original file order. */
export function listCrops(params: ListCropsParams = {}): CropEntry[] {
  const cal = loadCalendar();
  let out = cal.entries;
  if (params.category) {
    out = out.filter((e) => e.category === params.category);
  }
  if (params.season) {
    out = out.filter((e) => e.season === params.season);
  }
  if (params.zone) {
    const num = parseZoneNumber(params.zone);
    if (num !== null) {
      out = out.filter(
        (e) => e.zoneRange.min <= num && e.zoneRange.max >= num,
      );
    }
  }
  return out;
}

/** Look up a crop by slug, common name, scientific name, or alias.
 *  Match is case-insensitive and whitespace-insensitive. Returns the first
 *  exact match, then the first prefix match if no exact match exists. */
export function findCrop(slugOrName: string): CropEntry | undefined {
  const q = slugOrName.trim().toLowerCase();
  if (q.length === 0) return undefined;
  const cal = loadCalendar();
  // Exact match, slug, common name, scientific name, alias.
  for (const e of cal.entries) {
    if (e.slug === q) return e;
    if (e.commonName.toLowerCase() === q) return e;
    if (e.scientificName.toLowerCase() === q) return e;
    if (e.aliases?.some((a) => a.toLowerCase() === q)) return e;
  }
  // Prefix match.
  for (const e of cal.entries) {
    if (e.commonName.toLowerCase().startsWith(q)) return e;
    if (e.slug.startsWith(q)) return e;
    if (e.aliases?.some((a) => a.toLowerCase().startsWith(q))) return e;
  }
  // Substring fallback on common name.
  for (const e of cal.entries) {
    if (e.commonName.toLowerCase().includes(q)) return e;
  }
  return undefined;
}

/** Search crops, like findCrop but returns all matches up to `limit`. */
export function searchCrops(query: string, limit = 20): CropEntry[] {
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const cal = loadCalendar();
  const exact: CropEntry[] = [];
  const prefix: CropEntry[] = [];
  const sub: CropEntry[] = [];
  for (const e of cal.entries) {
    const haystack = [
      e.slug,
      e.commonName.toLowerCase(),
      e.scientificName.toLowerCase(),
      ...(e.aliases?.map((a) => a.toLowerCase()) ?? []),
    ];
    if (haystack.some((h) => h === q)) {
      exact.push(e);
    } else if (haystack.some((h) => h.startsWith(q))) {
      prefix.push(e);
    } else if (haystack.some((h) => h.includes(q))) {
      sub.push(e);
    }
  }
  return [...exact, ...prefix, ...sub].slice(0, limit);
}

function parseZoneNumber(zone: string): number | null {
  const m = /^(\d{1,2})/.exec(zone.trim().toLowerCase());
  if (!m || !m[1]) return null;
  const n = Number(m[1]);
  return Number.isInteger(n) && n >= 1 && n <= 13 ? n : null;
}

// ---------------------------------------------------------------------------
// Planting plan, given a zone and a date, which crops have an open window
// and what action should the gardener take?
// ---------------------------------------------------------------------------

export interface GetPlantingPlanParams {
  zone: ZoneInfo;
  /** ISO date YYYY-MM-DD. Defaults to today (UTC). */
  date?: string;
  /** Restrict by category. */
  category?: CropCategory;
  /** Cap on suggestions. Default 50. */
  limit?: number;
  /** Window padding in days, a crop is included if today is within
   *  [windowStart - padDays, windowEnd + padDays]. Default 0 (strict). */
  padDays?: number;
  /** Include indoor-only entries (microgreens, sprouts) in the plan.
   *  Default false because their year-round windows otherwise dominate
   *  earliest-harvest sorting. */
  includeIndoor?: boolean;
  /** Apply per-climate window shifts and notes. When unset, base values are
   *  used. Resolve from coords via `getClimateType` from `@cropgraph/core`. */
  climateType?: ClimateType;
}

export interface GetPlantingPlanResult {
  zone: ZoneInfo;
  frostDates: FrostDates;
  asOf: string;
  /** Crops with an open or imminent window for the requested date. */
  plantNow: PlantSuggestion[];
  /** Climate type the plan was computed against, if one was supplied. */
  climateType?: ClimateType;
}

export function getPlantingPlan(
  params: GetPlantingPlanParams,
): Result<GetPlantingPlanResult> {
  const dateIso = params.date ?? isoDateUtc();
  if (!/^\d{4}-\d{2}-\d{2}$/.test(dateIso)) {
    return err({
      source: "crop-calendar",
      message: `getPlantingPlan: bad ISO date ${dateIso}`,
    });
  }
  const frostRes = getFrostDates(params.zone.zone);
  if (!frostRes.ok) return frostRes;
  const frost = frostRes.data;
  const padDays = params.padDays ?? 0;
  const limit = params.limit ?? 50;
  if (!Number.isInteger(limit) || limit < 1 || limit > 1000) {
    return err({
      source: "crop-calendar",
      message: `getPlantingPlan: limit must be in [1..1000], got ${limit}`,
    });
  }

  const year = Number(dateIso.slice(0, 4));
  const lastSpringIso = frostMmDdToIsoDate(frost.lastSpring, year);
  const firstFallIso = frostMmDdToIsoDate(frost.firstFall, year);

  const cal = loadCalendar();
  const out: PlantSuggestion[] = [];
  const zoneNum = params.zone.zoneNumber;

  const includeIndoor = params.includeIndoor === true;
  const climate = params.climateType;
  for (const crop of cal.entries) {
    if (
      zoneNum < crop.zoneRange.min ||
      zoneNum > crop.zoneRange.max
    ) {
      continue;
    }
    if (params.category && crop.category !== params.category) continue;
    if (!includeIndoor && crop.growingContext === "indoor") continue;

    const modifier =
      climate && crop.climateModifiers
        ? crop.climateModifiers[climate]
        : undefined;

    // Find the first window that contains today (with optional padding).
    // Window dates are shifted by the climate modifier when one applies to
    // the action; duration is preserved.
    for (const w of crop.windows) {
      const shiftDays = climateShiftDays(modifier, w.action);
      const fromFrostDays = w.fromFrostDays + shiftDays;
      const toFrostDays = w.toFrostDays + shiftDays;
      const anchorIso =
        w.anchor === "last_spring" ? lastSpringIso : firstFallIso;
      const startIso = addDays(anchorIso, fromFrostDays - padDays);
      const endIso = addDays(anchorIso, toFrostDays + padDays);
      if (dateIso < startIso || dateIso > endIso) continue;

      // Compute earliest harvest if planted today.
      const expectedHarvest = addDays(dateIso, crop.daysToHarvest.min);

      const suggestion: PlantSuggestion = {
        slug: crop.slug,
        commonName: crop.commonName,
        scientificName: crop.scientificName,
        category: crop.category,
        action: w.action as PlantSuggestionAction,
        windowStart: addDays(anchorIso, fromFrostDays),
        windowEnd: addDays(anchorIso, toFrostDays),
        daysToHarvest: { ...crop.daysToHarvest },
        expectedHarvestEarliest: expectedHarvest,
      };
      const noteParts: string[] = [];
      if (w.notes) noteParts.push(w.notes);
      if (crop.notes) noteParts.push(crop.notes);
      if (modifier?.notes) noteParts.push(modifier.notes);
      if (noteParts.length > 0) suggestion.notes = noteParts.join(", ");
      out.push(suggestion);
      break; // one suggestion per crop per call (the first matching window)
    }
  }

  // Sort: action priority (start_indoors → direct_sow → transplant → plant_now),
  // then by expected harvest date (earliest first), then by name.
  const actionOrder: Record<PlantSuggestionAction, number> = {
    start_indoors: 0,
    direct_sow: 1,
    transplant: 2,
    plant_now: 3,
  };
  out.sort((a, b) => {
    const ao = actionOrder[a.action] - actionOrder[b.action];
    if (ao !== 0) return ao;
    if (a.expectedHarvestEarliest && b.expectedHarvestEarliest) {
      const cmp = a.expectedHarvestEarliest.localeCompare(
        b.expectedHarvestEarliest,
      );
      if (cmp !== 0) return cmp;
    }
    return a.commonName.localeCompare(b.commonName);
  });

  const result: GetPlantingPlanResult = {
    zone: params.zone,
    frostDates: frost,
    asOf: dateIso,
    plantNow: out.slice(0, limit),
  };
  if (climate) result.climateType = climate;
  return ok(result);
}

function climateShiftDays(
  modifier: ClimateModifier | undefined,
  action: PlantSuggestionAction,
): number {
  if (!modifier?.windowShifts) return 0;
  // Only shift the actions we know about; "plant_now" (perennial planting)
  // has no shift slot in ClimateModifier and stays at base.
  if (action === "start_indoors") {
    return (modifier.windowShifts.start_indoors ?? 0) * 7;
  }
  if (action === "direct_sow") {
    return (modifier.windowShifts.direct_sow ?? 0) * 7;
  }
  if (action === "transplant") {
    return (modifier.windowShifts.transplant ?? 0) * 7;
  }
  return 0;
}

/** List crops where the zone falls within their `zoneRange`. */
export function getCropsForZone(
  zone: string,
  category?: CropCategory,
): Result<CropEntry[]> {
  const num = parseZoneNumber(zone);
  if (num === null) {
    return err({
      source: "crop-calendar",
      message: `getCropsForZone: bad zone "${zone}", expected "1a".."13b"`,
    });
  }
  return ok(listCrops({ zone, ...(category ? { category } : {}) }));
}
