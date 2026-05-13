import {
  findCrop,
  getPestDetail,
  getPestsByCrop,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatPestDetailBlock,
  formatPestsBlock,
} from "../format-pest-disease.js";

function resolveCropArg(arg: string): string | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;
  return findCrop(trimmed)?.slug;
}

export function buildPestsCommand(): Command {
  return new Command("pests")
    .description(
      "Show pests and diseases affecting a crop, sorted by severity. Each entry carries diagnostic symptoms, organic management options, prevention practices, regions of significance, and a citation. The fixture is curated, not exhaustive; absence of an entry is not absence of pressure.",
    )
    .argument("<crop>", "Crop slug, common name, or scientific name")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph pests tomato",
        "  $ cropgraph pests cabbage --json",
        "  $ cropgraph pests 'Sweet Pepper'",
      ].join("\n"),
    )
    .action(async (cropArg: string, opts: { json?: boolean }) => {
      const slug = resolveCropArg(cropArg);
      if (!slug) {
        return fail(`no crop calendar match for "${cropArg}".`);
      }
      const entries = getPestsByCrop(slug);
      if (opts.json) return printJson({ crop: slug, entries });
      console.log(formatPestsBlock(slug, entries));
    });
}

export function buildPestDetailCommand(): Command {
  return new Command("pest-detail")
    .description(
      "Show full detail for one pest or disease: every crop it affects (with crop-specific symptoms and management), aggregated severity grades, and the union of regions of significance.",
    )
    .argument("<pest>", "Pest or disease slug (e.g. tomato-hornworm, late-blight, squash-bug)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph pest-detail tomato-hornworm",
        "  $ cropgraph pest-detail cabbage-worm --json",
        "  $ cropgraph pest-detail late-blight",
      ].join("\n"),
    )
    .action(async (pestArg: string, opts: { json?: boolean }) => {
      const slug = pestArg.trim().toLowerCase();
      if (!slug) return fail(`pest slug is required.`);
      const detail = getPestDetail(slug);
      if (!detail) {
        return fail(`no pest or disease entry for "${pestArg}". Try \`cropgraph pests <crop>\` to see what's tracked for a crop.`);
      }
      if (opts.json) return printJson(detail);
      console.log(formatPestDetailBlock(detail));
    });
}
