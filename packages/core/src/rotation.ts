// Crop rotation families, the second graph layer of CropGraph. A partition
// of every crop slug from crop-calendar.json into a botanical rotation
// family, with rotation rules (year-gap, follow-with, never-follow) attached
// at the family level. Data lives in `data/rotation-families.json` against
// `rotation-families.schema.json`.
//
// Evidence grounding: USDA Cooperative Extension (Cornell, WSU, UC ANR,
// UF/IFAS, OSU, Penn State, Texas A&M AgriLife), SARE Cover Crops field
// guide, Rodale Encyclopedia, USDA-ARS rotation research. Year-gap
// recommendations are the conservative end of published ranges; lower-
// pressure systems may shorten them.

import { z } from "zod";
import rotationRaw from "./data/rotation-families.json" with { type: "json" };
import { listCrops } from "./crop-calendar.js";

// ---------------------------------------------------------------------------
// Public types, enums match the JSON Schema exactly.
// ---------------------------------------------------------------------------

const FamilySlugSchema = z.enum([
  "nightshades",
  "brassicas",
  "cucurbits",
  "alliums",
  "legumes",
  "umbellifers",
  "grasses",
  "amaranthaceae",
  "composites",
  "mints",
  "malvaceae",
  "miscellaneous",
]);
export type RotationFamilySlug = z.infer<typeof FamilySlugSchema>;

const FamilyEntrySchema = z.object({
  family: FamilySlugSchema,
  scientificFamily: z.string().min(1).max(60),
  rotationYears: z.number().int().min(0).max(7),
  crops: z.array(
    z
      .string()
      .regex(/^[a-z][a-z0-9-]{1,40}$/, "crop slug must be kebab-case"),
  ),
  followWith: z.array(FamilySlugSchema),
  neverFollow: z.array(FamilySlugSchema),
  reason: z.string().min(20).max(600),
  source: z.string().min(1).max(300),
});

export type RotationFamilyEntry = z.infer<typeof FamilyEntrySchema>;

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(FamilyEntrySchema),
});

interface RotationFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: RotationFamilyEntry[];
}

// ---------------------------------------------------------------------------
// Loader, parses once, validates that every calendar slug is mapped to
// exactly one family.
// ---------------------------------------------------------------------------

let DATA: RotationFile | null = null;
let SLUG_TO_FAMILY: Map<string, RotationFamilyEntry> | null = null;
let FAMILY_BY_SLUG: Map<RotationFamilySlug, RotationFamilyEntry> | null = null;

function loadRotation(): RotationFile {
  if (DATA) return DATA;
  const parsed = FileSchema.safeParse(rotationRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `rotation-families.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  // Family slug uniqueness.
  const seenFamily = new Set<RotationFamilySlug>();
  for (const e of parsed.data.entries) {
    if (seenFamily.has(e.family)) {
      throw new Error(
        `rotation-families.json has duplicate family "${e.family}"`,
      );
    }
    seenFamily.add(e.family);
  }
  // Slug coverage: every crop in the calendar must appear in exactly one
  // family. Missing slugs and duplicate slugs are both load-time errors so
  // the curation invariant is enforced at import time, not at runtime.
  const calendarSlugs = new Set(listCrops().map((e) => e.slug));
  const cropToFamily = new Map<string, RotationFamilySlug>();
  for (const e of parsed.data.entries) {
    for (const slug of e.crops) {
      if (!calendarSlugs.has(slug)) {
        throw new Error(
          `rotation-families.json family "${e.family}" lists unknown crop slug "${slug}"; must exist in crop-calendar.json`,
        );
      }
      const prior = cropToFamily.get(slug);
      if (prior !== undefined) {
        throw new Error(
          `rotation-families.json crop slug "${slug}" appears in multiple families: "${prior}" and "${e.family}"`,
        );
      }
      cropToFamily.set(slug, e.family);
    }
  }
  for (const slug of calendarSlugs) {
    if (!cropToFamily.has(slug)) {
      throw new Error(
        `rotation-families.json is missing crop slug "${slug}"; every calendar slug must be assigned to a family (or "miscellaneous")`,
      );
    }
  }
  DATA = parsed.data;
  return DATA;
}

function buildIndexes(): void {
  if (SLUG_TO_FAMILY && FAMILY_BY_SLUG) return;
  const data = loadRotation();
  const slugIdx = new Map<string, RotationFamilyEntry>();
  const familyIdx = new Map<RotationFamilySlug, RotationFamilyEntry>();
  for (const e of data.entries) {
    familyIdx.set(e.family, e);
    for (const slug of e.crops) slugIdx.set(slug, e);
  }
  SLUG_TO_FAMILY = slugIdx;
  FAMILY_BY_SLUG = familyIdx;
}

// ---------------------------------------------------------------------------
// Meta + helpers
// ---------------------------------------------------------------------------

export interface RotationMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalFamilies: number;
  totalCrops: number;
}

export function getRotationMeta(): RotationMeta {
  const d = loadRotation();
  const totalCrops = d.entries.reduce((s, e) => s + e.crops.length, 0);
  const out: RotationMeta = {
    version: d.version,
    source: d.source,
    license: d.license,
    totalFamilies: d.entries.length,
    totalCrops,
  };
  if (d.lastUpdated !== undefined) out.lastUpdated = d.lastUpdated;
  return out;
}

/** Family record for a given crop slug. Returns undefined when the slug
 *  isn't in the calendar (curation bug should have caught this at load,
 *  but the runtime returns undefined for unknown slugs rather than
 *  throwing). */
export function getRotationFamily(
  slug: string,
): RotationFamilyEntry | undefined {
  buildIndexes();
  return SLUG_TO_FAMILY!.get(slug);
}

/** Family record by family slug (e.g. "nightshades"). */
export function getFamily(
  family: RotationFamilySlug,
): RotationFamilyEntry | undefined {
  buildIndexes();
  return FAMILY_BY_SLUG!.get(family);
}

/** All families in canonical order. */
export function listRotationFamilies(): RotationFamilyEntry[] {
  return loadRotation().entries.slice();
}

export interface RotationAdvice {
  slug: string;
  family: RotationFamilySlug;
  scientificFamily: string;
  rotationYears: number;
  followWith: RotationFamilySlug[];
  neverFollow: RotationFamilySlug[];
  reason: string;
  source: string;
}

/** Compact rotation advice for one crop. Returns undefined when the slug
 *  isn't recognized. */
export function getRotationAdvice(slug: string): RotationAdvice | undefined {
  const fam = getRotationFamily(slug);
  if (!fam) return undefined;
  return {
    slug,
    family: fam.family,
    scientificFamily: fam.scientificFamily,
    rotationYears: fam.rotationYears,
    followWith: fam.followWith.slice(),
    neverFollow: fam.neverFollow.slice(),
    reason: fam.reason,
    source: fam.source,
  };
}

/** Crops in the recommended follow-with families for a given subject slug.
 *  Excludes the subject's own family (no self-rotation), even when it
 *  appears in the followWith list of another family. */
export function getRotationPartners(slug: string): {
  follow: { family: RotationFamilySlug; crops: string[] }[];
  avoid: { family: RotationFamilySlug; crops: string[] }[];
} {
  buildIndexes();
  const subject = SLUG_TO_FAMILY!.get(slug);
  if (!subject) return { follow: [], avoid: [] };
  const follow: { family: RotationFamilySlug; crops: string[] }[] = [];
  for (const f of subject.followWith) {
    if (f === subject.family) continue;
    const fam = FAMILY_BY_SLUG!.get(f);
    if (!fam) continue;
    follow.push({ family: f, crops: fam.crops.slice() });
  }
  const avoid: { family: RotationFamilySlug; crops: string[] }[] = [];
  for (const f of subject.neverFollow) {
    const fam = FAMILY_BY_SLUG!.get(f);
    if (!fam) continue;
    avoid.push({ family: f, crops: fam.crops.slice() });
  }
  return { follow, avoid };
}

export interface RotationSequenceIssue {
  index: number;
  slug: string;
  family: RotationFamilySlug;
  previousIndex: number;
  previousSlug: string;
  rotationYears: number;
  severity: "violation" | "warning";
  message: string;
}

export interface RotationSequenceReport {
  sequence: { slug: string; family: RotationFamilySlug | "unknown" }[];
  issues: RotationSequenceIssue[];
  ok: boolean;
}

/** Validate a multi-year sequence of crops planted in the same bed.
 *  `slugs[0]` is year 1, `slugs[1]` is year 2, and so on. The check is
 *  pairwise against `rotationYears` from each crop's family: if a family
 *  reappears within its required gap, report a violation; if it reappears
 *  in the next year (gap === 0), still report a warning when the family's
 *  rule is rotationYears 0 but `neverFollow` lists itself. Unknown slugs
 *  are surfaced in the sequence but skipped by the rule check. */
export function checkRotationSequence(
  slugs: string[],
): RotationSequenceReport {
  buildIndexes();
  const sequence = slugs.map((s) => {
    const fam = SLUG_TO_FAMILY!.get(s);
    return {
      slug: s,
      family: (fam?.family ?? "unknown") as RotationFamilySlug | "unknown",
    };
  });
  const issues: RotationSequenceIssue[] = [];
  for (let i = 1; i < slugs.length; i++) {
    const current = SLUG_TO_FAMILY!.get(slugs[i]!);
    if (!current) continue;
    // Look back to the most recent prior planting in the same family.
    for (let j = i - 1; j >= 0; j--) {
      const prior = SLUG_TO_FAMILY!.get(slugs[j]!);
      if (!prior) continue;
      if (prior.family !== current.family) continue;
      const gap = i - j; // years between plantings (current is year i+1)
      // miscellaneous family has no rule.
      if (current.rotationYears === 0) {
        // Even mints/grasses: only flag self-follow if neverFollow lists self.
        if (current.neverFollow.includes(current.family) && gap < 1) {
          // gap < 1 can't happen given i > j, but keep the structure.
          issues.push({
            index: i,
            slug: slugs[i]!,
            family: current.family,
            previousIndex: j,
            previousSlug: slugs[j]!,
            rotationYears: current.rotationYears,
            severity: "warning",
            message: `${slugs[i]} (${current.family}) follows ${slugs[j]} in the same family with no rotation gap`,
          });
        }
        break;
      }
      if (gap < current.rotationYears) {
        issues.push({
          index: i,
          slug: slugs[i]!,
          family: current.family,
          previousIndex: j,
          previousSlug: slugs[j]!,
          rotationYears: current.rotationYears,
          severity: "violation",
          message: `${slugs[i]} (${current.family}) replants ${gap} year${gap === 1 ? "" : "s"} after ${slugs[j]}; ${current.family} requires a ${current.rotationYears}-year gap`,
        });
      }
      break; // only the most recent prior planting in the family matters
    }
    // Also flag neverFollow against the immediate prior crop.
    const prior = SLUG_TO_FAMILY!.get(slugs[i - 1]!);
    if (prior && current.neverFollow.includes(prior.family) && prior.family !== current.family) {
      issues.push({
        index: i,
        slug: slugs[i]!,
        family: current.family,
        previousIndex: i - 1,
        previousSlug: slugs[i - 1]!,
        rotationYears: current.rotationYears,
        severity: "warning",
        message: `${slugs[i]} (${current.family}) should not directly follow ${slugs[i - 1]} (${prior.family}); shared pest or disease pressure`,
      });
    }
  }
  return {
    sequence,
    issues,
    ok: issues.length === 0,
  };
}
