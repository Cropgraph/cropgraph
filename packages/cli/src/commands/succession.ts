import {
  findCrop,
  getHardinessZone,
  getHardinessZoneByZip,
  getSuccessionChain,
  getSuccessionPlan,
  isClimateType,
  listClimateTypes,
  type ClimateType,
  type ZoneInfo,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatSuccessionChainBlock,
  formatSuccessionPlanBlock,
} from "../format-succession.js";
import { resolveLocation } from "../resolve-location.js";

interface SuccessionOpts {
  zone?: string;
  lat?: string;
  lng?: string;
  zip?: string;
  climate?: string;
  year?: string;
  json?: boolean;
}

function resolveCropArg(arg: string): string | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;
  return findCrop(trimmed)?.slug;
}

function noMatchMessage(arg: string): string {
  return `no succession chain or crop match for "${arg}". Try \`cropgraph search ${JSON.stringify(arg)}\` to find a related crop.`;
}

export function buildSuccessionCommand(): Command {
  return new Command("succession")
    .description(
      "Show the succession planting chain for a crop. Returns frost-relative phases by default. Pass --zone (or --lat/--lng/--zip) to resolve concrete dates, and --climate to apply per-climate notes.",
    )
    .argument("<crop>", "Crop slug, common name, or scientific name")
    .option("--zone <zone>", 'USDA hardiness zone "1a".."13b" for a dated plan')
    .option("--lat <lat>", "Latitude (-90..90) for a dated plan")
    .option("--lng <lng>", "Longitude (-180..180) for a dated plan")
    .option("--zip <zip>", "5-digit US ZIP for a dated plan")
    .option(
      "--climate <type>",
      `Apply per-climate notes. One of: ${listClimateTypes().join(", ")}.`,
    )
    .option("--year <YYYY>", "Anchor the dated plan to a specific year")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph succession lettuce",
        "  $ cropgraph succession lettuce-leaf --zone 8b --climate maritime",
        "  $ cropgraph succession radish --lat 48.118 --lng -123.4307",
        "  $ cropgraph succession bush-bean --zip 10001 --json",
      ].join("\n"),
    )
    .action(async (cropArg: string, opts: SuccessionOpts) => {
      const trimmed = cropArg.trim();
      const cropSlug = resolveCropArg(trimmed);
      const chain =
        getSuccessionChain(trimmed) ??
        (cropSlug ? getSuccessionChain(cropSlug) : undefined);
      if (!chain) return fail(noMatchMessage(cropArg));

      const wantsDated =
        opts.zone || opts.lat || opts.lng || opts.zip;
      if (!wantsDated) {
        if (opts.json) return printJson(chain);
        console.log(formatSuccessionChainBlock(chain));
        return;
      }

      const zoneRes = await resolveZone(opts);
      if (!zoneRes.ok) return fail(zoneRes.error.message);
      let climateType: ClimateType | undefined;
      if (opts.climate) {
        if (!isClimateType(opts.climate)) {
          return fail(
            `--climate must be one of: ${listClimateTypes().join(", ")}; got "${opts.climate}"`,
          );
        }
        climateType = opts.climate;
      }
      let year: number | undefined;
      if (opts.year !== undefined) {
        const n = Number(opts.year);
        if (!Number.isInteger(n) || n < 1900 || n > 2200) {
          return fail(`--year must be a 4-digit year in [1900..2200], got "${opts.year}"`);
        }
        year = n;
      }
      const planRes = getSuccessionPlan({
        slug: chain.slug,
        zone: zoneRes.data,
        ...(climateType ? { climateType } : {}),
        ...(year !== undefined ? { year } : {}),
      });
      if (!planRes.ok) return fail(planRes.error.message);
      if (opts.json) return printJson(planRes.data);
      console.log(formatSuccessionPlanBlock(planRes.data));
    });
}

async function resolveZone(
  opts: SuccessionOpts,
): Promise<
  | { ok: true; data: ZoneInfo }
  | { ok: false; error: { message: string } }
> {
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
