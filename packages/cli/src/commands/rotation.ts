import {
  checkRotationSequence,
  findCrop,
  getRotationAdvice,
  getRotationPartners,
  type RotationFamilySlug,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatRotationBlock,
  formatRotationSequenceBlock,
} from "../format-rotation.js";

function resolveCropArg(arg: string): string | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;
  return findCrop(trimmed)?.slug;
}

function noMatchMessage(arg: string): string {
  return `no crop calendar match for "${arg}". Try \`cropgraph search ${JSON.stringify(arg)}\` for fuzzy matches.`;
}

export function buildRotationCommand(): Command {
  return new Command("rotation")
    .description(
      "Show the rotation family and rotation rules for a crop. Includes year-gap, follow-with families, and never-follow families.",
    )
    .argument("<crop>", "Crop slug, common name, or scientific name")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph rotation tomato",
        "  $ cropgraph rotation 'Sweet Corn'",
        "  $ cropgraph rotation strawberry --json",
      ].join("\n"),
    )
    .action(async (cropArg: string, opts: { json?: boolean }) => {
      const slug = resolveCropArg(cropArg);
      if (!slug) return fail(noMatchMessage(cropArg));
      const advice = getRotationAdvice(slug);
      if (!advice) return fail(`no rotation family for "${slug}"`);
      const partners = getRotationPartners(slug);
      if (opts.json) return printJson({ ...advice, partners });
      console.log(formatRotationBlock(advice, partners));
    });
}

export function buildRotationCheckCommand(): Command {
  return new Command("rotation-check")
    .description(
      "Check whether a multi-year sequence of crops planted in the same bed violates rotation rules. Crops are listed in planting order: year 1, year 2, year 3, ...",
    )
    .argument("<crops...>", "2 or more crops in planting-year order")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph rotation-check tomato pepper-sweet",
        "  $ cropgraph rotation-check tomato bush-bean sweet-corn cabbage",
        "  $ cropgraph rotation-check tomato cabbage tomato --json",
      ].join("\n"),
    )
    .action(async (crops: string[], opts: { json?: boolean }) => {
      if (!Array.isArray(crops) || crops.length < 2) {
        return fail("rotation-check requires at least 2 crops");
      }
      const slugs: string[] = [];
      for (const c of crops) {
        const s = resolveCropArg(c);
        if (!s) return fail(noMatchMessage(c));
        slugs.push(s);
      }
      const report = checkRotationSequence(slugs);
      if (opts.json) return printJson(report);
      console.log(formatRotationSequenceBlock(report));
    });
}

export type { RotationFamilySlug };
