import {
  getClimateType,
  getFrostDates,
  getHardinessZone,
  getHardinessZoneByZip,
  getPlantingPlan,
  isClimateType,
  listClimateTypes,
  type ClimateType,
  type Coordinates,
  type CropCategory,
  type ZoneInfo,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import { formatPlantingPlan, formatZoneBlock } from "../format-garden.js";
import { resolveLocation } from "../resolve-location.js";

interface ZoneOpts {
  lat?: string;
  lng?: string;
  zip?: string;
  json?: boolean;
}

interface PlantingOpts {
  lat?: string;
  lng?: string;
  zip?: string;
  zone?: string;
  date?: string;
  category?: string;
  limit?: string;
  includeIndoor?: boolean;
  climate?: string;
  json?: boolean;
}

const VALID_CATEGORIES: CropCategory[] = [
  "vegetable",
  "herb",
  "fruit",
  "flower",
  "cover-crop",
  "root",
  "legume",
];

export function buildZoneCommand(): Command {
  return new Command("zone")
    .description(
      "Show USDA hardiness zone, average winter min temp, and typical frost dates for a location.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--zip <zip>", "5-digit US ZIP (alternative to lat/lng)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph zone --lat 48.118 --lng -123.4307",
        "  $ cropgraph zone --zip 10001",
        "  $ cropgraph zone        # falls back to saved location",
        "",
        "Notes:",
        "  Zone data: PRISM Climate Group 2023 USDA Plant Hardiness Zone Map.",
        "  Coords resolve to the nearest of 40,283 ZIP centroids.",
        "  Frost dates are continental-US averages by zone; your microclimate",
        "  may shift them by 2-3 weeks (especially coastal/mountain/desert).",
      ].join("\n"),
    )
    .action(async (opts: ZoneOpts) => {
      const zoneRes = await resolveZoneFromZoneOpts(opts);
      if (!zoneRes.ok) return fail(zoneRes.error.message);
      const frost = getFrostDates(zoneRes.data.zone);
      const coords = await resolveCoordsFromOpts(opts);
      const climate = coords ? getClimateType(coords) : undefined;
      const climateType = climate?.ok ? climate.data.climateType : undefined;
      if (opts.json) {
        return printJson({
          zone: zoneRes.data,
          frostDates: frost.ok ? frost.data : null,
          ...(climateType ? { climateType } : {}),
        });
      }
      console.log(
        formatZoneBlock(
          zoneRes.data,
          frost.ok ? frost.data : undefined,
          climateType,
        ),
      );
    });
}

export function buildPlantingCommand(): Command {
  return new Command("planting")
    .description(
      "What to plant this week given a location's zone and frost dates. Cross-references the 1000-crop calendar with today's date and the typical frost dates, returning crops whose start/sow/transplant window is open right now.",
    )
    .option("--lat <lat>", "Latitude (-90..90)")
    .option("--lng <lng>", "Longitude (-180..180)")
    .option("--zip <zip>", "5-digit US ZIP (alternative to lat/lng)")
    .option(
      "--zone <zone>",
      'USDA hardiness zone "1a".."13b" (overrides location lookup)',
    )
    .option(
      "--date <YYYY-MM-DD>",
      "Plan against a specific date instead of today",
    )
    .option(
      "--category <name>",
      "Filter by category: vegetable, herb, fruit, flower, cover-crop, root, legume",
    )
    .option("-l, --limit <n>", "Cap on suggestions (1..500, default 50)")
    .option(
      "--include-indoor",
      "Include indoor-only crops (microgreens, sprouts).",
    )
    .option(
      "--climate <type>",
      `Apply per-climate modifiers. One of: ${listClimateTypes().join(", ")}. Auto-detected from coords/saved location when omitted.`,
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph planting",
        "  $ cropgraph planting --lat 48.118 --lng -123.4307",
        "  $ cropgraph planting --zone 5b --date 2026-04-01",
        "  $ cropgraph planting --category herb",
        "  $ cropgraph planting --include-indoor",
      ].join("\n"),
    )
    .action(async (opts: PlantingOpts) => {
      const zoneRes = await resolveZoneFromPlantingOpts(opts);
      if (!zoneRes.ok) return fail(zoneRes.error.message);
      const limit = takeLimit(opts.limit);
      let category: CropCategory | undefined;
      if (opts.category) {
        if (!(VALID_CATEGORIES as string[]).includes(opts.category)) {
          return fail(
            `--category must be one of: ${VALID_CATEGORIES.join(", ")}; got "${opts.category}"`,
          );
        }
        category = opts.category as CropCategory;
      }
      if (opts.date && !/^\d{4}-\d{2}-\d{2}$/.test(opts.date)) {
        return fail(`--date must be YYYY-MM-DD, got "${opts.date}"`);
      }
      const climateType = await resolveClimate(opts);
      const planRes = getPlantingPlan({
        zone: zoneRes.data,
        ...(opts.date ? { date: opts.date } : {}),
        ...(category ? { category } : {}),
        limit,
        ...(opts.includeIndoor ? { includeIndoor: true } : {}),
        ...(climateType ? { climateType } : {}),
      });
      if (!planRes.ok) return fail(planRes.error.message);
      if (opts.json) return printJson(planRes.data);
      console.log(
        formatPlantingPlan(
          planRes.data.zone,
          planRes.data.frostDates,
          planRes.data.asOf,
          planRes.data.plantNow,
          planRes.data.climateType,
        ),
      );
    });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

async function resolveCoordsFromOpts(
  opts: ZoneOpts | PlantingOpts,
): Promise<Coordinates | undefined> {
  if ("zip" in opts && opts.zip) return undefined;
  const loc = await resolveLocation({
    ...(opts.lat ? { lat: opts.lat } : {}),
    ...(opts.lng ? { lng: opts.lng } : {}),
  });
  return loc.ok ? loc.data.coords : undefined;
}

async function resolveClimate(
  opts: PlantingOpts,
): Promise<ClimateType | undefined> {
  if (opts.climate) {
    if (!isClimateType(opts.climate)) {
      return fail(
        `--climate must be one of: ${listClimateTypes().join(", ")}; got "${opts.climate}"`,
      );
    }
    return opts.climate;
  }
  const coords = await resolveCoordsFromOpts(opts);
  if (!coords) return undefined;
  const r = getClimateType(coords);
  return r.ok ? r.data.climateType : undefined;
}

async function resolveZoneFromZoneOpts(
  opts: ZoneOpts,
): Promise<{ ok: true; data: ZoneInfo } | { ok: false; error: { message: string } }> {
  if (opts.zip) return getHardinessZoneByZip(opts.zip);
  const loc = await resolveLocation({
    ...(opts.lat ? { lat: opts.lat } : {}),
    ...(opts.lng ? { lng: opts.lng } : {}),
  });
  if (!loc.ok) return loc;
  return getHardinessZone(loc.data.coords);
}

async function resolveZoneFromPlantingOpts(
  opts: PlantingOpts,
): Promise<{ ok: true; data: ZoneInfo } | { ok: false; error: { message: string } }> {
  if (opts.zone) {
    const m = /^(\d{1,2})([ab])$/i.exec(opts.zone.trim().toLowerCase());
    if (!m || !m[1] || !m[2]) {
      return {
        ok: false,
        error: { message: `--zone must look like "5a" or "8b", got "${opts.zone}"` },
      };
    }
    const num = Number(m[1]);
    const sub = m[2].toLowerCase() as "a" | "b";
    const minTempF = -60 + 10 * (num - 1) + (sub === "b" ? 5 : 0);
    return {
      ok: true,
      data: {
        zone: `${num}${sub}`,
        zoneNumber: num,
        subzone: sub,
        minTempF,
        maxTempF: minTempF + 5,
        source: "prism-2023",
        resolvedFrom: "zip-exact",
        zip: "00000",
      },
    };
  }
  if (opts.zip) return getHardinessZoneByZip(opts.zip);
  const loc = await resolveLocation({
    ...(opts.lat ? { lat: opts.lat } : {}),
    ...(opts.lng ? { lng: opts.lng } : {}),
  });
  if (!loc.ok) return loc;
  return getHardinessZone(loc.data.coords);
}

function takeLimit(raw: string | undefined): number {
  if (raw === undefined) return 50;
  const n = Number(raw);
  if (!Number.isInteger(n) || n < 1 || n > 500) {
    return fail(`--limit out of range (1..500): ${raw}`);
  }
  return n;
}
