// Pest species catalog. The loader cross-references against pest-disease.json
// at module load time so a curation bug breaks `import "@cropgraph/core"`
// immediately. These tests assert the contract.

import { describe, expect, test } from "vitest";
import {
  getPestSpecies,
  getPestSpeciesMeta,
  listPestSpecies,
} from "../src/index.js";
import pestDiseaseRaw from "../src/data/pest-disease.json" with { type: "json" };

describe("@cropgraph/core pest-species catalog", () => {
  test("meta reports the expected fixture shape", () => {
    const meta = getPestSpeciesMeta();
    expect(meta.totalEntries).toBeGreaterThan(0);
    expect(meta.totalWithScientificName + meta.totalDisorders).toBe(
      meta.totalEntries,
    );
    expect(meta.license.length).toBeGreaterThan(0);
  });

  test("every pest slug in pest-disease.json has a species row", () => {
    const slugs = new Set<string>();
    for (const e of (pestDiseaseRaw as { entries: { pest: string }[] })
      .entries) {
      slugs.add(e.pest);
    }
    for (const slug of slugs) {
      const row = getPestSpecies(slug);
      expect(row, `missing pest-species row for slug "${slug}"`).toBeDefined();
      if (!row) continue;
      expect(row.slug).toBe(slug);
      expect(row.commonName.length).toBeGreaterThanOrEqual(2);
      expect(row.source.length).toBeGreaterThan(0);
    }
  });

  test("every pest-species row is referenced by pest-disease.json", () => {
    const slugs = new Set<string>();
    for (const e of (pestDiseaseRaw as { entries: { pest: string }[] })
      .entries) {
      slugs.add(e.pest);
    }
    for (const row of listPestSpecies()) {
      expect(
        slugs.has(row.slug),
        `orphan pest-species row "${row.slug}" not referenced by pest-disease.json`,
      ).toBe(true);
    }
  });

  test("known agents resolve to the expected accepted names", () => {
    const hornworm = getPestSpecies("tomato-hornworm");
    expect(hornworm?.scientificName).toBe("Manduca quinquemaculata");

    const cabbageworm = getPestSpecies("cabbage-worm");
    expect(cabbageworm?.scientificName).toBe("Pieris rapae");

    const lateBlight = getPestSpecies("late-blight");
    expect(lateBlight?.scientificName).toBe("Phytophthora infestans");
  });

  test("physiological disorders carry scientificName: null", () => {
    const ber = getPestSpecies("blossom-end-rot");
    expect(ber).toBeDefined();
    expect(ber?.scientificName).toBeNull();
    expect(ber?.source.toLowerCase()).toContain("physiological");
  });

  test("listPestSpecies returns slug-sorted entries", () => {
    const all = listPestSpecies();
    for (let i = 1; i < all.length; i++) {
      expect(all[i]!.slug.localeCompare(all[i - 1]!.slug)).toBeGreaterThan(0);
    }
  });

  test("unknown slug returns undefined, not a thrown error", () => {
    expect(getPestSpecies("totally-not-a-pest")).toBeUndefined();
  });
});
