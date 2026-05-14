// Beneficial insects + pest intelligence smoke. Single contract: these all
// pass before shipping a new build.

import { describe, expect, test } from "vitest";
import {
  getBeneficialInsect,
  getBeneficialIntelligence,
  getBeneficialInsectsMeta,
  getBeneficialsAttractedBy,
  getBeneficialsForPest,
  getPestIntelligence,
  getVerdictForInsect,
  listBeneficials,
  searchBeneficials,
} from "../src/index.js";

describe("@cropgraph/core beneficial insects", () => {
  test("getBeneficialInsectsMeta reports 200+ entries across five categories", () => {
    const meta = getBeneficialInsectsMeta();
    expect(meta.totalEntries).toBeGreaterThanOrEqual(200);
    expect(meta.byCategory.predator).toBeGreaterThan(50);
    expect(meta.byCategory.parasitoid).toBeGreaterThan(30);
    expect(meta.byCategory.pollinator).toBeGreaterThan(40);
    expect(meta.byCategory.decomposer).toBeGreaterThan(20);
    expect(meta.byCategory["microbial-control"]).toBeGreaterThan(15);
  });

  test("getBeneficialInsect('seven-spotted-ladybug') returns the canonical record", () => {
    const e = getBeneficialInsect("seven-spotted-ladybug");
    expect(e).toBeDefined();
    expect(e?.commonName).toBe("Seven-Spotted Ladybug");
    expect(e?.category).toBe("predator");
    expect(e?.preyOn.length).toBeGreaterThan(0);
    expect(e?.attractedBy).toContain("dill");
  });

  test("listBeneficials filters by category", () => {
    const all = listBeneficials();
    const pollinators = listBeneficials("pollinator");
    expect(all.length).toBeGreaterThan(pollinators.length);
    for (const p of pollinators) expect(p.category).toBe("pollinator");
  });

  test("getBeneficialsForPest('tomato-hornworm') includes Cotesia braconid", () => {
    const list = getBeneficialsForPest("tomato-hornworm");
    const slugs = list.map((b) => b.slug);
    expect(slugs).toContain("braconid-wasp-cotesia-congregata");
    expect(slugs).toContain("bt-kurstaki");
  });

  test("getBeneficialsAttractedBy('dill') returns multiple beneficials", () => {
    const list = getBeneficialsAttractedBy("dill");
    expect(list.length).toBeGreaterThan(5);
  });

  test("searchBeneficials('ladybug') matches the ladybug entries", () => {
    const list = searchBeneficials("ladybug");
    expect(list.length).toBeGreaterThan(0);
    expect(list.some((b) => b.commonName.toLowerCase().includes("ladybug"))).toBe(
      true,
    );
  });

  test("getBeneficialsAttractedBy returns empty for unknown plant", () => {
    expect(getBeneficialsAttractedBy("not-a-real-plant")).toEqual([]);
  });
});

describe("@cropgraph/core pest intelligence", () => {
  test("getPestIntelligence('tomato-hornworm', 'tomato') returns the full now-what shape", () => {
    const r = getPestIntelligence("tomato-hornworm", "tomato");
    expect(r).toBeDefined();
    if (!r) return;
    expect(r.verdict).toBe("foe");
    expect(r.severity).toBe("high");
    expect(r.immediateAction.length).toBeGreaterThan(0);
    expect(r.companionDeterrents.length).toBeGreaterThan(0);
    expect(r.beneficialPredators.length).toBeGreaterThan(5);
    expect(r.beneficialNote).toMatch(/cocoons|braconid/i);
    expect(r.cropSpecific?.crop).toBe("tomato");
  });

  test("getPestIntelligence without plant still returns predator and deterrent lists", () => {
    const r = getPestIntelligence("aphid-cabbage");
    expect(r).toBeDefined();
    if (!r) return;
    expect(r.beneficialPredators.length).toBeGreaterThan(10);
    expect(r.beneficialNote).toMatch(/spray|predator/i);
  });

  test("getPestIntelligence returns undefined for unknown pest", () => {
    expect(getPestIntelligence("not-a-real-pest")).toBeUndefined();
  });

  test("getBeneficialIntelligence('seven-spotted-ladybug') reports protected crops", () => {
    const r = getBeneficialIntelligence("seven-spotted-ladybug");
    expect(r).toBeDefined();
    if (!r) return;
    expect(r.verdict).toBe("friend");
    expect(r.attractedBy.length).toBeGreaterThan(3);
    expect(r.protects.length).toBeGreaterThan(5);
    expect(r.protectionTips.length).toBeGreaterThan(0);
  });

  test("getVerdictForInsect classifies beneficial, pest, and unknown slugs", () => {
    expect(getVerdictForInsect("seven-spotted-ladybug")).toBe("friend");
    expect(getVerdictForInsect("tomato-hornworm")).toBe("foe");
    expect(getVerdictForInsect("not-a-real-slug")).toBe("neutral");
  });
});
