// Regression cover for issue #1: /api/rotation/:slug returned a 500 for four
// months because rotation-families.json had fallen 4,006 slugs behind the
// crop calendar.
//
// The data gap was the bug. The reason it shipped is that the coverage
// invariant lives inside a lazy loader, so it only ran when a rotation
// function was actually called, and nothing before a user's HTTP request
// ever called one. These tests call one.

import { describe, expect, test } from "vitest";
import {
  getRotationAdvice,
  getRotationFamily,
  getRotationPartners,
  listCrops,
  listRotationFamilies,
} from "../src/index.js";

describe("rotation family coverage", () => {
  test("the rotation fixture loads at all", () => {
    // Forces loadRotation(). If the fixture is incomplete this throws here,
    // in CI, instead of in production.
    const families = listRotationFamilies();
    expect(families.length).toBe(12);
  });

  test("every calendar slug is assigned to exactly one family", () => {
    const calendar = listCrops().map((c) => c.slug);
    const families = listRotationFamilies();

    const seen = new Map<string, string>();
    const duplicates: string[] = [];
    for (const family of families) {
      for (const slug of family.crops) {
        const prior = seen.get(slug);
        if (prior !== undefined) {
          duplicates.push(`${slug} (${prior} and ${family.family})`);
        }
        seen.set(slug, family.family);
      }
    }

    const missing = calendar.filter((slug) => !seen.has(slug));
    const orphans = [...seen.keys()].filter((slug) => !calendar.includes(slug));

    // Report the whole diff. A one-slug message is what turned a 4,006-entry
    // census into what looked like a typo.
    expect(
      { missing: missing.length, orphans: orphans.length, duplicates: duplicates.length },
      `missing: ${missing.slice(0, 10).join(", ")}\norphans: ${orphans.slice(0, 10).join(", ")}\nduplicates: ${duplicates.slice(0, 10).join(", ")}`,
    ).toEqual({ missing: 0, orphans: 0, duplicates: 0 });

    expect(seen.size).toBe(calendar.length);
  });

  test("the slug from issue #1 resolves, and resolves correctly", () => {
    const advice = getRotationAdvice("early-girl-tomato");
    expect(advice).toBeDefined();
    // Agronomy, not just a non-throw: a tomato variety is Solanaceae, and
    // filing it under miscellaneous would be worse than the 500 it replaced.
    expect(advice?.family).toBe("nightshades");
    expect(advice?.scientificFamily).toBe("Solanaceae");
    expect(advice?.rotationYears).toBe(3);
  });

  test("variety-level slugs inherit the family of their species", () => {
    const parent = getRotationFamily("tomato");
    expect(parent).toBeDefined();
    for (const slug of ["better-boy-tomato", "celebrity-tomato", "stupice-tomato"]) {
      expect(getRotationFamily(slug)?.family, slug).toBe(parent?.family);
    }
    // Peppers are Solanaceae too, whatever the Capsicum species.
    expect(getRotationFamily("pepper-thai")?.family).toBe("nightshades");
    expect(getRotationFamily("pepper-datil")?.family).toBe("nightshades");
  });

  test("woody perennial trees stay out of the rotation families", () => {
    // A family assignment is a claim about what to plant next, and legumes is
    // named in nine of the twelve followWith lists. Botanical purity here
    // would make the API answer "after your tomatoes, plant black locust".
    for (const slug of ["black-locust", "honey-locust-thornless", "redbud-eastern"]) {
      expect(getRotationFamily(slug)?.family, slug).toBe("miscellaneous");
    }
    const partners = getRotationPartners("tomato");
    const legumes = partners.follow.find((p) => p.family === "legumes");
    expect(legumes).toBeDefined();
    expect(legumes?.crops).not.toContain("black-locust");
  });

  test("bed-grown woody crops keep their botanical family", () => {
    // The exception to the rule above, and the reason it is a rule about
    // function rather than habit: goji is a shrub, but it is grown in beds
    // and shares Verticillium and Fusarium with every other nightshade.
    expect(getRotationFamily("goji-phoenix-tears")?.family).toBe("nightshades");
    // Bamboo follows the curated Phyllostachys precedent.
    expect(getRotationFamily("bamboo-oldhamii")?.family).toBe("grasses");
  });
});
