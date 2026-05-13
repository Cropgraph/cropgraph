// Succession planting chains, the third graph edge layer of CropGraph. Maps
// crops to time-sequenced planting chains so a single bed yields a continuous
// harvest across a growing season. Data lives in `data/succession-chains.json`
// against `succession-chains.schema.json`. Every `chains[].crop` slug is
// cross-referenced against crop-calendar.json at parse time; a bad PR breaks
// the import of `@cropgraph/core` immediately rather than at runtime.
//
// Evidence grounding: Johnny's Selected Seeds succession publications, Cornell
// Cooperative Extension small-farm planting calendars, UF/IFAS, UC ANR,
// SARE Cover Crops field guide, Eliot Coleman's New Organic Grower succession
// tables, USDA-NRCS cover crop publications. Frost-anchored windows use
// last-spring-frost (LSF) as day 0; negative days fall before LSF.

import { z } from "zod";
import successionRaw from "./data/succession-chains.json" with { type: "json" };
import type { ClimateType } from "./climate-types.js";
import { listCrops } from "./crop-calendar.js";
import { err, ok, type Result } from "./result.js";
import type { FrostDates, ZoneInfo } from "./types.js";
import {
  addDays,
  frostMmDdToIsoDate,
  getFrostDates,
} from "./usda-zones.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CategorySchema = z.enum([
  "continuous-harvest",
  "root-succession",
  "legume-succession",
  "brassica-succession",
  "cucurbit-relay",
  "herb-succession",
  "flower-succession",
  "cover-crop-relay",
]);
export type SuccessionCategory = z.infer<typeof CategorySchema>;

const SowMethodSchema = z.enum(["direct_sow", "transplant", "start_indoors"]);
export type SuccessionSowMethod = z.infer<typeof SowMethodSchema>;

const ClimateNotesSchema = z
  .object({
    maritime: z.string().min(1).max(300).optional(),
    mediterranean: z.string().min(1).max(300).optional(),
    continental: z.string().min(1).max(300).optional(),
    humid_subtropical: z.string().min(1).max(300).optional(),
    arid: z.string().min(1).max(300).optional(),
    semi_arid: z.string().min(1).max(300).optional(),
  })
  .optional();

export type SuccessionClimateNotes = z.infer<typeof ClimateNotesSchema>;

const PhaseSchema = z
  .object({
    phase: z.number().int().min(1).max(12),
    crop: z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,40}$/, "crop must be a kebab-case slug"),
    sowMethod: SowMethodSchema,
    intervalWeeks: z.number().int().min(1).max(12).nullable(),
    startRelativeToFrost: z.number().int().min(-270).max(270),
    endRelativeToFrost: z.number().int().min(-270).max(270),
    climateNotes: ClimateNotesSchema,
    notes: z.string().min(1).max(300).optional(),
  })
  .refine((p) => p.endRelativeToFrost >= p.startRelativeToFrost, {
    message: "endRelativeToFrost must be >= startRelativeToFrost",
  });

export type SuccessionPhase = z.infer<typeof PhaseSchema>;

const ChainSchema = z.object({
  slug: z
    .string()
    .regex(
      /^[a-z][a-z0-9-]{1,60}$/,
      "chain slug must be kebab-case starting with a letter",
    ),
  primaryCrop: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,40}$/, "primaryCrop must be a kebab-case slug"),
  category: CategorySchema,
  chains: z.array(PhaseSchema).min(1),
  source: z.string().min(1).max(300),
});

export type SuccessionChain = z.infer<typeof ChainSchema>;

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(ChainSchema),
});

interface SuccessionFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: SuccessionChain[];
}

// ---------------------------------------------------------------------------
// Loader: parses once, then validates slug existence against the crop calendar
// and slug uniqueness within the fixture.
// ---------------------------------------------------------------------------

let DATA: SuccessionFile | null = null;
let BY_SLUG: Map<string, SuccessionChain> | null = null;
let BY_PRIMARY_CROP: Map<string, SuccessionChain[]> | null = null;
let BY_PHASE_CROP: Map<string, SuccessionChain[]> | null = null;

function loadSuccession(): SuccessionFile {
  if (DATA) return DATA;
  const parsed = FileSchema.safeParse(successionRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `succession-chains.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  const cropSlugs = new Set(listCrops().map((e) => e.slug));
  const seenSlug = new Set<string>();
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const chain = parsed.data.entries[i]!;
    if (seenSlug.has(chain.slug)) {
      throw new Error(
        `succession-chains.json has duplicate chain slug "${chain.slug}"`,
      );
    }
    seenSlug.add(chain.slug);
    if (!cropSlugs.has(chain.primaryCrop)) {
      throw new Error(
        `succession-chains.json entry[${i}] ("${chain.slug}") references unknown primaryCrop "${chain.primaryCrop}", must exist in crop-calendar.json`,
      );
    }
    for (let j = 0; j < chain.chains.length; j++) {
      const phase = chain.chains[j]!;
      if (!cropSlugs.has(phase.crop)) {
        throw new Error(
          `succession-chains.json entry[${i}] ("${chain.slug}") phase ${phase.phase} references unknown crop "${phase.crop}", must exist in crop-calendar.json`,
        );
      }
    }
  }
  DATA = parsed.data;
  return DATA;
}

function buildIndexes(): void {
  if (BY_SLUG && BY_PRIMARY_CROP && BY_PHASE_CROP) return;
  const data = loadSuccession();
  const bySlug = new Map<string, SuccessionChain>();
  const byPrimary = new Map<string, SuccessionChain[]>();
  const byPhase = new Map<string, SuccessionChain[]>();
  for (const chain of data.entries) {
    bySlug.set(chain.slug, chain);
    let pList = byPrimary.get(chain.primaryCrop);
    if (!pList) {
      pList = [];
      byPrimary.set(chain.primaryCrop, pList);
    }
    pList.push(chain);
    const seenInChain = new Set<string>();
    for (const phase of chain.chains) {
      if (seenInChain.has(phase.crop)) continue;
      seenInChain.add(phase.crop);
      let cList = byPhase.get(phase.crop);
      if (!cList) {
        cList = [];
        byPhase.set(phase.crop, cList);
      }
      cList.push(chain);
    }
  }
  BY_SLUG = bySlug;
  BY_PRIMARY_CROP = byPrimary;
  BY_PHASE_CROP = byPhase;
}

// ---------------------------------------------------------------------------
// Meta + helpers
// ---------------------------------------------------------------------------

export interface SuccessionMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalChains: number;
  totalPhases: number;
}

export function getSuccessionMeta(): SuccessionMeta {
  const d = loadSuccession();
  let totalPhases = 0;
  for (const c of d.entries) totalPhases += c.chains.length;
  const out: SuccessionMeta = {
    version: d.version,
    source: d.source,
    license: d.license,
    totalChains: d.entries.length,
    totalPhases,
  };
  if (d.lastUpdated !== undefined) out.lastUpdated = d.lastUpdated;
  return out;
}

/** Look up a chain by chain slug (e.g. `lettuce-succession`), by the primary
 *  crop slug (e.g. `lettuce-leaf` returns the lettuce chain), or by any crop
 *  slug that appears as a phase. When multiple chains contain the slug, the
 *  one whose `primaryCrop` matches wins; otherwise the first chain in file
 *  order is returned. Returns undefined when no chain references the slug. */
export function getSuccessionChain(slug: string): SuccessionChain | undefined {
  buildIndexes();
  const direct = BY_SLUG!.get(slug);
  if (direct) return direct;
  const byPrimary = BY_PRIMARY_CROP!.get(slug);
  if (byPrimary && byPrimary[0]) return byPrimary[0];
  const byPhase = BY_PHASE_CROP!.get(slug);
  if (byPhase && byPhase[0]) return byPhase[0];
  return undefined;
}

/** All chains, optionally filtered by category. Returns entries in file order. */
export function listSuccessionChains(
  category?: SuccessionCategory,
): SuccessionChain[] {
  const d = loadSuccession();
  if (!category) return d.entries.slice();
  return d.entries.filter((c) => c.category === category);
}

/** All chains that reference a crop slug (as primary crop or in any phase). */
export function getChainsForCrop(slug: string): SuccessionChain[] {
  buildIndexes();
  const seen = new Set<string>();
  const out: SuccessionChain[] = [];
  for (const c of BY_PRIMARY_CROP!.get(slug) ?? []) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
  }
  for (const c of BY_PHASE_CROP!.get(slug) ?? []) {
    if (seen.has(c.slug)) continue;
    seen.add(c.slug);
    out.push(c);
  }
  return out;
}

// ---------------------------------------------------------------------------
// Concrete plan, resolves frost-relative days into ISO dates for a zone.
// ---------------------------------------------------------------------------

export interface SuccessionPlanPhase {
  phase: number;
  crop: string;
  sowMethod: SuccessionSowMethod;
  intervalWeeks: number | null;
  windowStart: string;
  windowEnd: string;
  /** ISO sowing dates within the window when intervalWeeks is set, else
   *  a single-element array with windowStart. */
  sowingDates: string[];
  notes?: string;
  climateNote?: string;
}

export interface SuccessionPlan {
  chain: {
    slug: string;
    primaryCrop: string;
    category: SuccessionCategory;
    source: string;
  };
  zone: ZoneInfo;
  frostDates: FrostDates;
  climateType?: ClimateType;
  /** ISO year the plan is anchored to. Defaults to the current UTC year. */
  year: number;
  phases: SuccessionPlanPhase[];
}

export interface GetSuccessionPlanParams {
  slug: string;
  zone: ZoneInfo;
  climateType?: ClimateType;
  /** ISO year (4-digit) to anchor the plan. Defaults to current UTC year. */
  year?: number;
}

/** Resolve a chain's frost-relative days into ISO dates for a zone. Each
 *  phase gets concrete windowStart/windowEnd dates and, when intervalWeeks
 *  is set, a list of sowing dates stepped through the window. */
export function getSuccessionPlan(
  params: GetSuccessionPlanParams,
): Result<SuccessionPlan> {
  const chain = getSuccessionChain(params.slug);
  if (!chain) {
    return err({
      source: "succession",
      message: `no succession chain for "${params.slug}"`,
    });
  }
  const frostRes = getFrostDates(params.zone.zone);
  if (!frostRes.ok) return frostRes;
  const frost = frostRes.data;
  const year =
    params.year ?? new Date().getUTCFullYear();
  if (!Number.isInteger(year) || year < 1900 || year > 2200) {
    return err({
      source: "succession",
      message: `getSuccessionPlan: year out of range, got ${year}`,
    });
  }
  const lastSpringIso = frostMmDdToIsoDate(frost.lastSpring, year);
  const climate = params.climateType;

  const phases: SuccessionPlanPhase[] = [];
  for (const phase of chain.chains) {
    const windowStart = addDays(lastSpringIso, phase.startRelativeToFrost);
    const windowEnd = addDays(lastSpringIso, phase.endRelativeToFrost);
    const sowingDates: string[] = [];
    if (phase.intervalWeeks && phase.intervalWeeks > 0) {
      const stepDays = phase.intervalWeeks * 7;
      let cursorOffset = phase.startRelativeToFrost;
      while (cursorOffset <= phase.endRelativeToFrost) {
        sowingDates.push(addDays(lastSpringIso, cursorOffset));
        cursorOffset += stepDays;
      }
    } else {
      sowingDates.push(windowStart);
    }
    const planPhase: SuccessionPlanPhase = {
      phase: phase.phase,
      crop: phase.crop,
      sowMethod: phase.sowMethod,
      intervalWeeks: phase.intervalWeeks,
      windowStart,
      windowEnd,
      sowingDates,
    };
    if (phase.notes) planPhase.notes = phase.notes;
    const climateNote =
      climate && phase.climateNotes
        ? phase.climateNotes[climate]
        : undefined;
    if (climateNote) planPhase.climateNote = climateNote;
    phases.push(planPhase);
  }

  const plan: SuccessionPlan = {
    chain: {
      slug: chain.slug,
      primaryCrop: chain.primaryCrop,
      category: chain.category,
      source: chain.source,
    },
    zone: params.zone,
    frostDates: frost,
    year,
    phases,
  };
  if (climate) plan.climateType = climate;
  return ok(plan);
}
