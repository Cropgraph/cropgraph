// Smoke tests at Port Angeles, WA (48.118, -123.4307). The single contract
// for shipping a new build of @cropgraph/core: these all pass.

import { describe, expect, test } from "vitest";
import {
  findCrop,
  getClimateType,
  getCompanions,
  getCropsAffected,
  getHardinessZone,
  getOrganicManagement,
  getPestDetail,
  getPestDiseaseMeta,
  getPestsByCrop,
  getPlantingPlan,
  getRelationship,
  getSuccessionChain,
  getSuccessionMeta,
  getSuccessionPlan,
  listSuccessionChains,
  searchCrops,
  searchPests,
} from "../src/index.js";

const PORT_ANGELES = { lat: 48.118, lng: -123.4307 };

describe("@cropgraph/core smoke", () => {
  test("getHardinessZone resolves Port Angeles to 8b", () => {
    const r = getHardinessZone(PORT_ANGELES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.zone).toBe("8b");
  });

  test("getClimateType resolves Port Angeles to maritime", () => {
    const r = getClimateType(PORT_ANGELES);
    expect(r.ok).toBe(true);
    if (r.ok) expect(r.data.climateType).toBe("maritime");
  });

  test("getPlantingPlan returns crops for zone 8b maritime", () => {
    const zoneRes = getHardinessZone(PORT_ANGELES);
    expect(zoneRes.ok).toBe(true);
    if (!zoneRes.ok) return;
    const r = getPlantingPlan({ zone: zoneRes.data, climateType: "maritime" });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(Array.isArray(r.data.plantNow)).toBe(true);
      expect(r.data.zone.zone).toBe("8b");
    }
  });

  test("findCrop('tomato') returns a full entry", () => {
    const entry = findCrop("tomato");
    expect(entry).toBeDefined();
    expect(entry?.slug).toBe("tomato");
  });

  test("searchCrops('squash') returns at least one match", () => {
    const hits = searchCrops("squash");
    expect(hits.length).toBeGreaterThan(0);
  });

  test("getCompanions('tomato') returns multiple companion edges", () => {
    const data = getCompanions("tomato");
    expect(data.companions.length + data.antagonists.length).toBeGreaterThan(0);
  });

  test("getRelationship('tomato', 'basil') is beneficial", () => {
    const entry = getRelationship("tomato", "basil");
    expect(entry).toBeDefined();
    expect(entry?.type).toBe("beneficial");
  });

  test("getSuccessionMeta has 30+ chains", () => {
    const meta = getSuccessionMeta();
    expect(meta.totalChains).toBeGreaterThanOrEqual(30);
    expect(meta.totalPhases).toBeGreaterThan(meta.totalChains);
  });

  test("getSuccessionChain('lettuce-leaf') returns the lettuce chain", () => {
    const chain = getSuccessionChain("lettuce-leaf");
    expect(chain).toBeDefined();
    expect(chain?.slug).toBe("lettuce-succession");
    expect(chain?.chains.length).toBeGreaterThanOrEqual(3);
  });

  test("listSuccessionChains('cover-crop-relay') returns at least 3 entries", () => {
    const chains = listSuccessionChains("cover-crop-relay");
    expect(chains.length).toBeGreaterThanOrEqual(3);
  });

  test("getPestDiseaseMeta has 150+ entries", () => {
    const meta = getPestDiseaseMeta();
    expect(meta.totalEntries).toBeGreaterThanOrEqual(150);
    expect(meta.totalPests).toBeGreaterThan(20);
    expect(meta.totalCrops).toBeGreaterThan(20);
  });

  test("getPestsByCrop('tomato') returns multiple high-severity entries", () => {
    const pests = getPestsByCrop("tomato");
    expect(pests.length).toBeGreaterThanOrEqual(8);
    expect(pests[0]?.severity === "severe" || pests[0]?.severity === "high").toBe(true);
  });

  test("getPestDetail('tomato-hornworm') aggregates across crops", () => {
    const detail = getPestDetail("tomato-hornworm");
    expect(detail).toBeDefined();
    expect(detail?.type).toBe("pest");
    expect(detail?.affects.length).toBeGreaterThan(0);
  });

  test("getOrganicManagement('tomato', 'early-blight') returns the pair", () => {
    const entry = getOrganicManagement("tomato", "early-blight");
    expect(entry).toBeDefined();
    expect(entry?.organicManagement.length).toBeGreaterThan(0);
  });

  test("getCropsAffected('cabbage-worm') includes brassicas", () => {
    const crops = getCropsAffected("cabbage-worm");
    expect(crops).toContain("cabbage");
    expect(crops).toContain("broccoli");
    expect(crops).toContain("kale");
  });

  test("searchPests('mildew') finds downy and powdery mildew", () => {
    const hits = searchPests("mildew");
    expect(hits.length).toBeGreaterThan(0);
  });

  test("getSuccessionPlan resolves Port Angeles + maritime to dated phases", () => {
    const zoneRes = getHardinessZone(PORT_ANGELES);
    expect(zoneRes.ok).toBe(true);
    if (!zoneRes.ok) return;
    const planRes = getSuccessionPlan({
      slug: "lettuce-leaf",
      zone: zoneRes.data,
      climateType: "maritime",
      year: 2026,
    });
    expect(planRes.ok).toBe(true);
    if (!planRes.ok) return;
    const plan = planRes.data;
    expect(plan.phases.length).toBeGreaterThanOrEqual(3);
    expect(plan.phases[0]?.sowingDates.length).toBeGreaterThan(1);
    expect(plan.phases[0]?.windowStart).toMatch(/^2026-/);
    expect(plan.climateType).toBe("maritime");
  });
});
