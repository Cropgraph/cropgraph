// Smoke tests at Port Angeles, WA (48.118, -123.4307). The single contract
// for shipping a new build of @cropgraph/core: these all pass.

import { describe, expect, test } from "vitest";
import {
  findCrop,
  getClimateType,
  getCompanions,
  getHardinessZone,
  getPlantingPlan,
  getRelationship,
  searchCrops,
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
});
