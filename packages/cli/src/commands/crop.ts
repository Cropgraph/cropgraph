import {
  findCrop,
  searchCrops,
  type CropCategory,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatCropEntry,
  formatCropSummaryRow,
} from "../format-garden.js";

interface CropOpts {
  json?: boolean;
}

interface SearchOpts {
  zone?: string;
  category?: string;
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
  "grain",
  "mushroom",
  "native",
  "medicinal",
  "fiber",
  "forage",
  "sprout",
];

export function buildCropCommand(): Command {
  return new Command("crop")
    .description(
      "Look up a single crop by common name, scientific name, or slug. Shows the calendar entry: planting windows, days to harvest, zone range, and notes.",
    )
    .argument("<name>", "Crop slug, common name, or scientific name")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph crop tomato",
        "  $ cropgraph crop 'Solanum lycopersicum'",
        "  $ cropgraph crop kale --json",
      ].join("\n"),
    )
    .action(async (nameArg: string, opts: CropOpts) => {
      const crop = findCrop(nameArg);
      if (!crop) {
        return fail(
          `no calendar match for "${nameArg}". Try \`cropgraph search ${JSON.stringify(nameArg)}\` for fuzzy matches.`,
        );
      }
      if (opts.json) return printJson(crop);
      console.log(formatCropEntry(crop));
    });
}

export function buildSearchCommand(): Command {
  return new Command("search")
    .description(
      "Search the bundled 1000-crop calendar by name. Filter by zone or category to narrow matches.",
    )
    .argument("<query>", "Search query (common name, scientific name, substring)")
    .option(
      "--zone <zone>",
      'Filter to entries whose zone range includes "1a".."13b"',
    )
    .option(
      "--category <name>",
      "Filter by category (vegetable, herb, fruit, flower, cover-crop, root, legume, grain, mushroom, native, medicinal, fiber, forage, sprout)",
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph search bean",
        "  $ cropgraph search cucurbit --category vegetable",
        "  $ cropgraph search bean --zone 8b --json",
      ].join("\n"),
    )
    .action(async (queryArg: string, opts: SearchOpts) => {
      let category: CropCategory | undefined;
      if (opts.category) {
        if (!(VALID_CATEGORIES as string[]).includes(opts.category)) {
          return fail(
            `--category must be one of: ${VALID_CATEGORIES.join(", ")}; got "${opts.category}"`,
          );
        }
        category = opts.category as CropCategory;
      }
      const matches = searchCrops(queryArg, 50).filter((c) => {
        if (category && c.category !== category) return false;
        if (opts.zone) {
          const num = parseInt(opts.zone.replace(/[^0-9]/g, ""), 10);
          if (num < c.zoneRange.min || num > c.zoneRange.max) return false;
        }
        return true;
      });
      if (opts.json) return printJson({ query: queryArg, matches });
      if (matches.length === 0) {
        return console.log(`No matches for "${queryArg}".`);
      }
      const out: string[] = [`🌱 Crop calendar matches (${matches.length}):`];
      for (const c of matches) out.push(formatCropSummaryRow(c));
      console.log(out.join("\n"));
    });
}
