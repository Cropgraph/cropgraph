// Build-time data gate for @cropgraph/core.
//
// This runs after tsup against the freshly built dist, and it deliberately
// calls the real loaders rather than reimplementing their rules. A second
// copy of an invariant is a second thing to drift; the point of this script
// is that it cannot disagree with the library, because it IS the library.
//
// Wired into `build`, so it blocks a local build, blocks CI, and blocks
// publish.yml before `pnpm -r publish` can put a broken fixture on npm.
// The loader's own guard stays where it is, as defense in depth, but this
// is the line it should never be reached past.

import { listCrops, listRotationFamilies, getRotationAdvice } from "../dist/index.js";

const checks = [];
function check(name, fn) {
  try {
    const detail = fn();
    checks.push({ name, ok: true, detail });
  } catch (err) {
    checks.push({ name, ok: false, detail: err instanceof Error ? err.message : String(err) });
  }
}

// Touching listRotationFamilies() forces the rotation loader, which is where
// the coverage invariant lives. This alone is what four months of green CI
// was missing.
check("rotation families load", () => {
  const families = listRotationFamilies();
  return `${families.length} families`;
});

// Independent recount, so the gate states the number rather than trusting a
// silent pass.
check("every calendar slug has a family", () => {
  const calendar = listCrops().map((c) => c.slug);
  const assigned = new Set(listRotationFamilies().flatMap((f) => f.crops));
  const missing = calendar.filter((s) => !assigned.has(s));
  if (missing.length > 0) {
    throw new Error(
      `${missing.length} of ${calendar.length} calendar slugs unassigned: ${missing.slice(0, 10).join(", ")}`,
    );
  }
  if (assigned.size !== calendar.length) {
    throw new Error(`assigned ${assigned.size} slugs but calendar holds ${calendar.length}`);
  }
  return `${calendar.length}/${calendar.length} assigned`;
});

// The slug from issue #1. A named regression, not an abstraction.
check("early-girl-tomato resolves to nightshades", () => {
  const advice = getRotationAdvice("early-girl-tomato");
  if (!advice) throw new Error("no rotation advice returned");
  if (advice.family !== "nightshades") {
    throw new Error(`expected nightshades, got ${advice.family}`);
  }
  return `${advice.family}, ${advice.rotationYears}-year gap`;
});

let failed = 0;
for (const c of checks) {
  process.stdout.write(`  ${c.ok ? "ok  " : "FAIL"}  ${c.name}: ${c.detail}\n`);
  if (!c.ok) failed++;
}

if (failed > 0) {
  process.stderr.write(`\nvalidate-data: ${failed} of ${checks.length} checks failed; refusing to ship this build.\n`);
  process.exit(1);
}
process.stdout.write(`validate-data: ${checks.length} checks passed.\n`);
