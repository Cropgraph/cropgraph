import {
  checkBedCompatibility,
  findCrop,
  getCompanions,
  getRelationship,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatCheckBlock,
  formatCompanionsBlock,
  formatPlanBlock,
} from "../format-companions.js";

function resolveCropArg(arg: string): string | undefined {
  const trimmed = arg.trim();
  if (!trimmed) return undefined;
  return findCrop(trimmed)?.slug;
}

function noMatchMessage(arg: string): string {
  return `no crop calendar match for "${arg}". Try \`cropgraph search ${JSON.stringify(arg)}\` for fuzzy matches.`;
}

export function buildCompanionsCommand(): Command {
  return new Command("companions")
    .description(
      "List companion (beneficial) and antagonist plants for a crop. 121 hand-curated edges from USDA Extension / Xerces Society / SARE sources. Accepts slug or common name.",
    )
    .argument("<crop>", "Crop slug, common name, or scientific name")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph companions tomato",
        "  $ cropgraph companions 'Sweet Pepper'",
        "  $ cropgraph companions fennel-herb --json",
      ].join("\n"),
    )
    .action(async (cropArg: string, opts: { json?: boolean }) => {
      const slug = resolveCropArg(cropArg);
      if (!slug) return fail(noMatchMessage(cropArg));
      const data = getCompanions(slug);
      if (opts.json) return printJson({ slug, ...data });
      console.log(formatCompanionsBlock(slug, data));
    });
}

export function buildCheckCommand(): Command {
  return new Command("check")
    .description(
      "Check whether two specific crops have a known beneficial or antagonist relationship. Accepts slugs or common names.",
    )
    .argument("<crop1>")
    .argument("<crop2>")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph check tomato basil",
        "  $ cropgraph check tomato fennel-herb",
        "  $ cropgraph check Tomato Watermelon",
      ].join("\n"),
    )
    .action(
      async (cropA: string, cropB: string, opts: { json?: boolean }) => {
        const slugA = resolveCropArg(cropA);
        if (!slugA) return fail(noMatchMessage(cropA));
        const slugB = resolveCropArg(cropB);
        if (!slugB) return fail(noMatchMessage(cropB));
        const entry = getRelationship(slugA, slugB);
        if (opts.json) {
          return printJson(
            entry
              ? { found: true, ...entry }
              : { found: false, crop_a: slugA, crop_b: slugB },
          );
        }
        console.log(formatCheckBlock(slugA, slugB, entry));
      },
    );
}

export function buildPlanCommand(): Command {
  return new Command("plan")
    .description(
      "Evaluate a group of crops planted in the same bed. Reports all pairwise beneficial and antagonist relationships and warns when one crop antagonizes multiple others.",
    )
    .argument("<crops...>", "2 or more crops (slugs or common names)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph plan tomato basil marigold carrot",
        "  $ cropgraph plan tomato fennel-herb bush-bean garlic",
        "  $ cropgraph plan tomato basil --json",
      ].join("\n"),
    )
    .action(async (crops: string[], opts: { json?: boolean }) => {
      if (!Array.isArray(crops) || crops.length < 2) {
        return fail("plan requires at least 2 crops");
      }
      const slugs: string[] = [];
      for (const c of crops) {
        const s = resolveCropArg(c);
        if (!s) return fail(noMatchMessage(c));
        slugs.push(s);
      }
      const report = checkBedCompatibility(slugs);
      if (opts.json) return printJson(report);
      console.log(formatPlanBlock(report));
    });
}
