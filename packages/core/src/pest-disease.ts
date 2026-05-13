// Pest and disease associations, the fourth graph edge layer of CropGraph.
// Maps crops to the pests and diseases that affect them, with diagnostic
// symptoms, organic management options, prevention practices, regions, and
// citations. Data lives in `data/pest-disease.json` against
// `pest-disease.schema.json`. Every `crop` slug is cross-referenced against
// crop-calendar.json at parse time so a curation bug breaks `import
// "@cropgraph/core"` immediately rather than at runtime.
//
// Evidence grounding: Cornell Cooperative Extension, UC IPM Online, UF/IFAS
// Extension, Penn State Extension, OSU Extension, WSU Extension, Texas A&M
// AgriLife Extension, Rodale Encyclopedia of Organic Gardening, USDA-ARS
// pest profiles. Management is restricted to OMRI-listed materials,
// biocontrols, and physical/cultural practices; conventional synthetic
// pesticides are intentionally out of scope.

import { z } from "zod";
import pestRaw from "./data/pest-disease.json" with { type: "json" };
import { findByMechanism, type CompanionEntry } from "./companions.js";
import { listCrops } from "./crop-calendar.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const TypeSchema = z.enum(["pest", "disease"]);
export type PestDiseaseType = z.infer<typeof TypeSchema>;

const SeveritySchema = z.enum(["low", "moderate", "high", "severe"]);
export type PestSeverity = z.infer<typeof SeveritySchema>;

const EntrySchema = z.object({
  crop: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,40}$/, "crop must be a kebab-case slug"),
  pest: z
    .string()
    .regex(/^[a-z][a-z0-9-]{1,60}$/, "pest must be a kebab-case slug"),
  type: TypeSchema,
  severity: SeveritySchema,
  symptoms: z.string().min(10).max(600),
  organicManagement: z.array(z.string().min(3).max(300)).min(1),
  prevention: z.string().min(5).max(400),
  regions: z.array(z.string().min(2).max(40)).min(1),
  source: z.string().min(1).max(300),
});

export type PestDiseaseEntry = z.infer<typeof EntrySchema>;

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(EntrySchema),
});

interface PestDiseaseFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: PestDiseaseEntry[];
}

// ---------------------------------------------------------------------------
// Loader: parses once, then validates that every `crop` slug exists in the
// calendar. Pest slugs are not validated against an external source, they
// form their own namespace.
// ---------------------------------------------------------------------------

let DATA: PestDiseaseFile | null = null;
let BY_CROP: Map<string, PestDiseaseEntry[]> | null = null;
let BY_PEST: Map<string, PestDiseaseEntry[]> | null = null;
let PAIR_INDEX: Map<string, PestDiseaseEntry> | null = null;

function pairKey(crop: string, pest: string): string {
  return `${crop} ${pest}`;
}

function loadPestDisease(): PestDiseaseFile {
  if (DATA) return DATA;
  const parsed = FileSchema.safeParse(pestRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `pest-disease.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  const cropSlugs = new Set(listCrops().map((e) => e.slug));
  const seenPair = new Set<string>();
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const e = parsed.data.entries[i]!;
    if (!cropSlugs.has(e.crop)) {
      throw new Error(
        `pest-disease.json entry[${i}] references unknown crop slug "${e.crop}"; must exist in crop-calendar.json`,
      );
    }
    const key = pairKey(e.crop, e.pest);
    if (seenPair.has(key)) {
      throw new Error(
        `pest-disease.json has duplicate (crop, pest) pair "${e.crop} / ${e.pest}"`,
      );
    }
    seenPair.add(key);
  }
  DATA = parsed.data;
  return DATA;
}

function buildIndexes(): void {
  if (BY_CROP && BY_PEST && PAIR_INDEX) return;
  const data = loadPestDisease();
  const byCrop = new Map<string, PestDiseaseEntry[]>();
  const byPest = new Map<string, PestDiseaseEntry[]>();
  const pair = new Map<string, PestDiseaseEntry>();
  for (const e of data.entries) {
    let c = byCrop.get(e.crop);
    if (!c) {
      c = [];
      byCrop.set(e.crop, c);
    }
    c.push(e);
    let p = byPest.get(e.pest);
    if (!p) {
      p = [];
      byPest.set(e.pest, p);
    }
    p.push(e);
    pair.set(pairKey(e.crop, e.pest), e);
  }
  BY_CROP = byCrop;
  BY_PEST = byPest;
  PAIR_INDEX = pair;
}

// ---------------------------------------------------------------------------
// Meta + helpers
// ---------------------------------------------------------------------------

export interface PestDiseaseMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalEntries: number;
  totalPests: number;
  totalCrops: number;
}

export function getPestDiseaseMeta(): PestDiseaseMeta {
  const d = loadPestDisease();
  const pestSet = new Set<string>();
  const cropSet = new Set<string>();
  for (const e of d.entries) {
    pestSet.add(e.pest);
    cropSet.add(e.crop);
  }
  const out: PestDiseaseMeta = {
    version: d.version,
    source: d.source,
    license: d.license,
    totalEntries: d.entries.length,
    totalPests: pestSet.size,
    totalCrops: cropSet.size,
  };
  if (d.lastUpdated !== undefined) out.lastUpdated = d.lastUpdated;
  return out;
}

const SEVERITY_RANK: Record<PestSeverity, number> = {
  severe: 4,
  high: 3,
  moderate: 2,
  low: 1,
};

function sortBySeverity(entries: PestDiseaseEntry[]): PestDiseaseEntry[] {
  return entries
    .slice()
    .sort((a, b) => {
      const sr = SEVERITY_RANK[b.severity] - SEVERITY_RANK[a.severity];
      if (sr !== 0) return sr;
      return a.pest.localeCompare(b.pest);
    });
}

/** All pest/disease entries for a crop, sorted by severity desc then by pest
 *  slug. Returns an empty array for crops with no recorded entries; the
 *  fixture is not exhaustive. */
export function getPestsByCrop(slug: string): PestDiseaseEntry[] {
  buildIndexes();
  return sortBySeverity(BY_CROP!.get(slug) ?? []);
}

export interface PestDetailReport {
  pest: string;
  type: PestDiseaseType;
  affects: PestDiseaseEntry[];
  /** Distinct severity grades observed across affected crops. */
  severities: PestSeverity[];
  /** Region labels aggregated across affected crops, deduplicated. */
  regions: string[];
}

/** Full detail for one pest/disease across every crop it touches. Returns
 *  undefined when the pest slug isn't in the fixture. */
export function getPestDetail(pestSlug: string): PestDetailReport | undefined {
  buildIndexes();
  const entries = BY_PEST!.get(pestSlug);
  if (!entries || entries.length === 0) return undefined;
  const first = entries[0]!;
  const severities = Array.from(
    new Set(entries.map((e) => e.severity)),
  ).sort((a, b) => SEVERITY_RANK[b] - SEVERITY_RANK[a]);
  const regionSet = new Set<string>();
  for (const e of entries) for (const r of e.regions) regionSet.add(r);
  return {
    pest: pestSlug,
    type: first.type,
    affects: sortBySeverity(entries),
    severities,
    regions: Array.from(regionSet).sort(),
  };
}

/** Single-pair lookup: management notes for one (crop, pest) combination.
 *  Returns undefined when the combination isn't in the fixture. */
export function getOrganicManagement(
  cropSlug: string,
  pestSlug: string,
): PestDiseaseEntry | undefined {
  buildIndexes();
  return PAIR_INDEX!.get(pairKey(cropSlug, pestSlug));
}

/** All crop slugs a given pest is recorded against. */
export function getCropsAffected(pestSlug: string): string[] {
  buildIndexes();
  const entries = BY_PEST!.get(pestSlug);
  if (!entries) return [];
  return Array.from(new Set(entries.map((e) => e.crop))).sort();
}

/** Substring search across pest slug, type, severity, and symptoms text.
 *  Returns up to `limit` matches, deduplicated by pest slug (so a query
 *  matching cabbage worm across 5 crops returns one row). */
export function searchPests(
  query: string,
  limit = 20,
): PestDetailReport[] {
  buildIndexes();
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const matchedPests = new Set<string>();
  for (const [pest, entries] of BY_PEST!) {
    if (pest.toLowerCase().includes(q)) {
      matchedPests.add(pest);
      continue;
    }
    for (const e of entries) {
      if (e.symptoms.toLowerCase().includes(q)) {
        matchedPests.add(pest);
        break;
      }
    }
  }
  const out: PestDetailReport[] = [];
  for (const pest of matchedPests) {
    const detail = getPestDetail(pest);
    if (detail) out.push(detail);
    if (out.length >= limit) break;
  }
  return out;
}

// ---------------------------------------------------------------------------
// Cross-reference with companion data: for each pest entry, look up the
// companion plants whose mechanism is `pest_repellent` or `trap_crop` so the
// gardener can act on the link without juggling two fixtures.
// ---------------------------------------------------------------------------

export interface PestWithDeterrents extends PestDiseaseEntry {
  /** Companion plants known to deter pests in general. Not a guarantee
   *  this companion targets this specific pest; the link is heuristic. */
  deterrentCompanions: CompanionEntry[];
}

/** Pest entries for a crop, enriched with the crop's known pest-repellent
 *  and trap-crop companion plants (from the companions fixture). The
 *  deterrent link is not always pest-specific; it's a starting point for
 *  the gardener to plan companion interplantings. */
export function getPestsWithDeterrents(
  cropSlug: string,
): PestWithDeterrents[] {
  const pests = getPestsByCrop(cropSlug);
  if (pests.length === 0) return [];
  // Pull companion entries for the crop where mechanism is pest_repellent
  // or trap_crop. We do this by intersecting `findByMechanism(...)` with
  // the crop's name, since the companions module doesn't have a per-crop
  // by-mechanism helper.
  const candidates = [
    ...findByMechanism("pest_repellent"),
    ...findByMechanism("trap_crop"),
  ];
  const deterrents: CompanionEntry[] = [];
  const seen = new Set<string>();
  for (const e of candidates) {
    if (e.crop !== cropSlug && e.companion !== cropSlug) continue;
    const key = `${e.crop} ${e.companion}`;
    if (seen.has(key)) continue;
    seen.add(key);
    deterrents.push(e);
  }
  return pests.map((p) => ({ ...p, deterrentCompanions: deterrents }));
}
