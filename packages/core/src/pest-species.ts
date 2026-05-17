// Pest species catalog. Slug-keyed scientific names for every pest and
// disease referenced from pest-disease.json. Data lives in
// `data/pest-species.json` against `pest-species.schema.json`. Loader
// validates bidirectional referential integrity at module load: every
// distinct `pest` slug in pest-disease.json must have a row here, and every
// row here must be referenced by at least one entry in pest-disease.json.
// A curation bug therefore breaks `import "@cropgraph/core"` immediately
// rather than at runtime.
//
// Scope: pests (insects, mites, mollusks, nematodes, vertebrates) and
// diseases (fungi, oomycetes, bacteria, viruses). Physiological disorders
// (blossom-end-rot, sunscald, catfacing, tipburn, bitter-pit,
// prussic-acid-poisoning) are not biological agents; their `scientificName`
// is null with an explicit disorder note in `source`.
//
// Evidence grounding: GBIF Backbone Taxonomy, UC IPM Online, Cornell
// Cooperative Extension, UF/IFAS Featured Creatures, EPPO Global Database,
// ICTV Master Species List, USDA-ARS, Penn State Extension.

import { z } from "zod";
import speciesRaw from "./data/pest-species.json" with { type: "json" };
import pestDiseaseRaw from "./data/pest-disease.json" with { type: "json" };
import { getPestDiseaseMeta } from "./pest-disease.js";

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const SLUG_REGEX = /^[a-z][a-z0-9-]{1,60}$/;

const EntrySchema = z.object({
  slug: z.string().regex(SLUG_REGEX, "slug must be a kebab-case identifier"),
  commonName: z.string().min(2).max(100),
  scientificName: z.string().min(2).max(200).nullable(),
  source: z.string().min(1).max(500),
});

export type PestSpecies = z.infer<typeof EntrySchema>;

const FileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(EntrySchema),
});

interface PestSpeciesFile {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  entries: PestSpecies[];
}

// ---------------------------------------------------------------------------
// Loader: parses once, then asserts bidirectional cross-reference with
// pest-disease.json. Throws on curation bugs at module load.
// ---------------------------------------------------------------------------

let DATA: PestSpeciesFile | null = null;
let BY_SLUG: Map<string, PestSpecies> | null = null;

function loadPestSpecies(): PestSpeciesFile {
  if (DATA) return DATA;
  const parsed = FileSchema.safeParse(speciesRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    const path = issue?.path.join(".") ?? "(root)";
    throw new Error(
      `pest-species.json failed validation at ${path}: ${issue?.message ?? "unknown"}`,
    );
  }
  const seen = new Set<string>();
  for (let i = 0; i < parsed.data.entries.length; i++) {
    const e = parsed.data.entries[i]!;
    if (seen.has(e.slug)) {
      throw new Error(
        `pest-species.json has duplicate slug "${e.slug}" at entry[${i}]`,
      );
    }
    seen.add(e.slug);
  }
  DATA = parsed.data;
  return DATA;
}

// Reads the parsed pest-disease.json data and collects every distinct
// `pest` slug. Used for bidirectional cross-reference at load time.
function collectPestSlugsFromDisease(): Set<string> {
  // getPestDiseaseMeta() drives the pest-disease loader so we know the
  // file is already parsed and validated. The raw JSON has the same shape
  // and is what we use here to avoid leaking pest-disease's internal
  // indexes through its public surface.
  const raw = pestDiseaseRaw as { entries: Array<{ pest: string }> };
  const out = new Set<string>();
  for (const e of raw.entries) out.add(e.pest);
  return out;
}

function buildIndex(): void {
  if (BY_SLUG) return;
  const data = loadPestSpecies();
  const idx = new Map<string, PestSpecies>();
  for (const e of data.entries) idx.set(e.slug, e);
  // Force pest-disease validation to run before our cross-check, so that
  // if pest-disease.json itself is broken we surface that error first
  // rather than a confusing "missing row" message.
  getPestDiseaseMeta();
  const pestSlugsFromDisease = collectPestSlugsFromDisease();
  for (const slug of pestSlugsFromDisease) {
    if (!idx.has(slug)) {
      throw new Error(
        `pest-species.json is missing row for slug "${slug}" referenced by pest-disease.json`,
      );
    }
  }
  for (const slug of idx.keys()) {
    if (!pestSlugsFromDisease.has(slug)) {
      throw new Error(
        `pest-species.json has orphan entry "${slug}" with no reference in pest-disease.json`,
      );
    }
  }
  BY_SLUG = idx;
}

// ---------------------------------------------------------------------------
// Meta + helpers
// ---------------------------------------------------------------------------

export interface PestSpeciesMeta {
  version: string;
  source: string;
  license: string;
  lastUpdated?: string;
  totalEntries: number;
  totalWithScientificName: number;
  totalDisorders: number;
}

export function getPestSpeciesMeta(): PestSpeciesMeta {
  const d = loadPestSpecies();
  let withName = 0;
  let disorders = 0;
  for (const e of d.entries) {
    if (e.scientificName === null) disorders++;
    else withName++;
  }
  const out: PestSpeciesMeta = {
    version: d.version,
    source: d.source,
    license: d.license,
    totalEntries: d.entries.length,
    totalWithScientificName: withName,
    totalDisorders: disorders,
  };
  if (d.lastUpdated !== undefined) out.lastUpdated = d.lastUpdated;
  return out;
}

/** Single-slug lookup: returns the species record for a pest or disease
 *  slug, or undefined when the slug is not in the catalog. */
export function getPestSpecies(slug: string): PestSpecies | undefined {
  buildIndex();
  return BY_SLUG!.get(slug);
}

/** All pest species entries, sorted by slug. Useful for building bulk
 *  internal lookup tables in downstream packages. */
export function listPestSpecies(): PestSpecies[] {
  buildIndex();
  return Array.from(BY_SLUG!.values()).sort((a, b) =>
    a.slug.localeCompare(b.slug),
  );
}
