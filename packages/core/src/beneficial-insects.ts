// Beneficial insects, microbes, and friend-not-foe invertebrates, the fifth
// edge layer of CropGraph. Data lives in `data/beneficial-insects.json`
// against `beneficial-insects.schema.json`. Cross-references are validated at
// module load time: `preyOn` entries must exist in pest-disease.json,
// `attractedBy` entries must exist in crop-calendar.json, `confusedWith` may
// reference either another beneficial slug or a pest slug. A curation bug
// therefore breaks `import "@cropgraph/core"` immediately rather than at
// runtime.
//
// Evidence grounding: Xerces Society for Invertebrate Conservation, Cornell
// Cooperative Extension biocontrol fact sheets, UC IPM Online Natural Enemies
// Gallery, UF/IFAS Featured Creatures, Penn State Extension, USDA-ARS
// Beneficial Insects Research Unit. Identification tips prioritize visual
// recognition over taxonomy.

import { z } from "zod";
import insectsRaw from "./data/beneficial-insects.json" with { type: "json" };
import { listCrops } from "./crop-calendar.js";
import { getPestDetail } from "./pest-disease.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const CategorySchema = z.enum([
  "predator",
  "parasitoid",
  "pollinator",
  "decomposer",
  "microbial-control",
]);
export type BeneficialCategory = z.infer<typeof CategorySchema>;

const SeasonSchema = z.enum(["spring", "summer", "fall", "winter"]);
export type Season = z.infer<typeof SeasonSchema>;

const SeasonalPresenceSchema = z.object({
  active: z.array(SeasonSchema),
  dormant: z.array(SeasonSchema),
});
export type SeasonalPresence = z.infer<typeof SeasonalPresenceSchema>;

const SLUG_REGEX = /^[a-z][a-z0-9-]{1,60}$/;
const PLANT_SLUG_REGEX = /^[a-z][a-z0-9-]{1,40}$/;

const EntrySchema = z.object({
  slug: z.string().regex(SLUG_REGEX, "slug must be a kebab-case identifier"),
  commonName: z.string().min(2).max(80),
  scientificName: z.string().min(2).max(120),
  category: CategorySchema,
  preyOn: z.array(z.string().regex(SLUG_REGEX)),
  attractedBy: z.array(z.string().regex(PLANT_SLUG_REGEX)),
  habitatNeeds: z.string().min(10).max(500),
  gardenRole: z.string().min(10).max(600),
  identificationTips: z.string().min(10).max(600),
  confusedWith: z.string().regex(SLUG_REGEX).optional(),
  confusionNote: z.string().min(10).max(500).optional(),
  seasonalPresence: SeasonalPresenceSchema,
  regions: z.array(z.string().min(2).max(40)).min(1),
  source: z.string().min(1).max(300),
});

export type BeneficialInsect = z.infer<typeof EntrySchema>;

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(EntrySchema),
});

interface BeneficialFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: BeneficialInsect[];
}

// ---------------------------------------------------------------------------
// Loader: parses once, then validates every cross-reference against the other
// fixtures. Throws on curation bugs at module load.
// ---------------------------------------------------------------------------

let DATA: BeneficialFile | null = null;
let BY_SLUG: Map<string, BeneficialInsect> | null = null;
let BY_CATEGORY: Map<BeneficialCategory, BeneficialInsect[]> | null = null;
let BY_PREY: Map<string, BeneficialInsect[]> | null = null;
let BY_PLANT: Map<string, BeneficialInsect[]> | null = null;

function loadBeneficials(): BeneficialFile {
  if (DATA) return DATA;
  const parsed = FileSchema.safeParse(insectsRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `beneficial-insects.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  const cropSlugs = new Set(listCrops().map((e) => e.slug));
  const insectSlugs = new Set(parsed.data.entries.map((e) => e.slug));
  const seenSlugs = new Set<string>();
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const e = parsed.data.entries[i]!;
    if (seenSlugs.has(e.slug)) {
      throw new Error(
        `beneficial-insects.json entry[${i}] has duplicate slug "${e.slug}"`,
      );
    }
    seenSlugs.add(e.slug);
    for (const plant of e.attractedBy) {
      if (!cropSlugs.has(plant)) {
        throw new Error(
          `beneficial-insects.json entry "${e.slug}" attractedBy references unknown plant slug "${plant}"; must exist in crop-calendar.json`,
        );
      }
    }
    for (const pest of e.preyOn) {
      if (!getPestDetail(pest)) {
        throw new Error(
          `beneficial-insects.json entry "${e.slug}" preyOn references unknown pest slug "${pest}"; must exist in pest-disease.json`,
        );
      }
    }
    if (e.confusedWith !== undefined) {
      const isBeneficial = insectSlugs.has(e.confusedWith);
      const isPest = getPestDetail(e.confusedWith) !== undefined;
      if (!isBeneficial && !isPest) {
        throw new Error(
          `beneficial-insects.json entry "${e.slug}" confusedWith references unknown slug "${e.confusedWith}"; must exist in either beneficial-insects.json or pest-disease.json`,
        );
      }
    }
  }
  DATA = parsed.data;
  return DATA;
}

function buildIndexes(): void {
  if (BY_SLUG && BY_CATEGORY && BY_PREY && BY_PLANT) return;
  const data = loadBeneficials();
  const bySlug = new Map<string, BeneficialInsect>();
  const byCategory = new Map<BeneficialCategory, BeneficialInsect[]>();
  const byPrey = new Map<string, BeneficialInsect[]>();
  const byPlant = new Map<string, BeneficialInsect[]>();
  for (const e of data.entries) {
    bySlug.set(e.slug, e);
    let c = byCategory.get(e.category);
    if (!c) {
      c = [];
      byCategory.set(e.category, c);
    }
    c.push(e);
    for (const pest of e.preyOn) {
      let p = byPrey.get(pest);
      if (!p) {
        p = [];
        byPrey.set(pest, p);
      }
      p.push(e);
    }
    for (const plant of e.attractedBy) {
      let pl = byPlant.get(plant);
      if (!pl) {
        pl = [];
        byPlant.set(plant, pl);
      }
      pl.push(e);
    }
  }
  BY_SLUG = bySlug;
  BY_CATEGORY = byCategory;
  BY_PREY = byPrey;
  BY_PLANT = byPlant;
}

// ---------------------------------------------------------------------------
// Meta + lookups
// ---------------------------------------------------------------------------

export interface BeneficialInsectsMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalEntries: number;
  byCategory: Record<BeneficialCategory, number>;
  totalPredatorPreyEdges: number;
  totalAttractorEdges: number;
}

export function getBeneficialInsectsMeta(): BeneficialInsectsMeta {
  buildIndexes();
  const data = loadBeneficials();
  const byCategory: Record<BeneficialCategory, number> = {
    predator: 0,
    parasitoid: 0,
    pollinator: 0,
    decomposer: 0,
    "microbial-control": 0,
  };
  let preyEdges = 0;
  let attractorEdges = 0;
  for (const e of data.entries) {
    byCategory[e.category] += 1;
    preyEdges += e.preyOn.length;
    attractorEdges += e.attractedBy.length;
  }
  const out: BeneficialInsectsMeta = {
    version: data.version,
    source: data.source,
    license: data.license,
    totalEntries: data.entries.length,
    byCategory,
    totalPredatorPreyEdges: preyEdges,
    totalAttractorEdges: attractorEdges,
  };
  if (data.lastUpdated !== undefined) out.lastUpdated = data.lastUpdated;
  return out;
}

/** Single beneficial by slug. Returns undefined when the slug is unknown. */
export function getBeneficialInsect(slug: string): BeneficialInsect | undefined {
  buildIndexes();
  return BY_SLUG!.get(slug);
}

/** All beneficials, optionally filtered by category. Sorted by common name. */
export function listBeneficials(
  category?: BeneficialCategory,
): BeneficialInsect[] {
  buildIndexes();
  const list = category
    ? (BY_CATEGORY!.get(category) ?? []).slice()
    : Array.from(BY_SLUG!.values());
  return list.sort((a, b) => a.commonName.localeCompare(b.commonName));
}

/** All beneficials that prey on (or parasitize, or suppress) a given pest. */
export function getBeneficialsForPest(pestSlug: string): BeneficialInsect[] {
  buildIndexes();
  const list = BY_PREY!.get(pestSlug);
  if (!list) return [];
  return list.slice().sort((a, b) => a.commonName.localeCompare(b.commonName));
}

/** All beneficials attracted to a given plant. */
export function getBeneficialsAttractedBy(
  plantSlug: string,
): BeneficialInsect[] {
  buildIndexes();
  const list = BY_PLANT!.get(plantSlug);
  if (!list) return [];
  return list.slice().sort((a, b) => a.commonName.localeCompare(b.commonName));
}

/** Substring search across slug, common name, scientific name, garden role,
 *  and identification tips. Returns up to `limit` matches. */
export function searchBeneficials(
  query: string,
  limit = 20,
): BeneficialInsect[] {
  buildIndexes();
  const q = query.trim().toLowerCase();
  if (q.length === 0) return [];
  const matches: BeneficialInsect[] = [];
  for (const e of BY_SLUG!.values()) {
    if (
      e.slug.toLowerCase().includes(q) ||
      e.commonName.toLowerCase().includes(q) ||
      e.scientificName.toLowerCase().includes(q) ||
      e.gardenRole.toLowerCase().includes(q) ||
      e.identificationTips.toLowerCase().includes(q)
    ) {
      matches.push(e);
      if (matches.length >= limit) break;
    }
  }
  return matches;
}
