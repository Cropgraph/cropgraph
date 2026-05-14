import {
  findCrop,
  getBeneficialInsect,
  getBeneficialIntelligence,
  getPestIntelligence,
  getVerdictForInsect,
  listBeneficials,
  type BeneficialCategory,
} from "@cropgraph/core";
import { Command } from "commander";
import { fail, printJson } from "../format.js";
import {
  formatBeneficialDetail,
  formatBeneficialsList,
  formatPestIntelligence,
} from "../format-beneficials.js";

const VALID_CATEGORIES: BeneficialCategory[] = [
  "predator",
  "parasitoid",
  "pollinator",
  "decomposer",
  "microbial-control",
];

function resolvePlantArg(arg: string | undefined): string | undefined {
  if (!arg) return undefined;
  return findCrop(arg.trim())?.slug;
}

export function buildPestIntelCommand(): Command {
  return new Command("pest-intel")
    .description(
      "Composite pest intelligence: severity verdict, immediate action steps, seasonal prevention, companion plant deterrents and trap crops, beneficial predators with the 'wait before spraying' guidance, and friend-or-foe lookalikes. The 'now what?' answer after a pest is identified.",
    )
    .argument("<pest>", "Pest or disease slug (e.g. tomato-hornworm, aphid-cabbage, late-blight)")
    .option("-p, --plant <crop>", "Crop slug for crop-specific symptoms and companion recommendations")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph pest-intel tomato-hornworm --plant tomato",
        "  $ cropgraph pest-intel aphid-cabbage --plant kale",
        "  $ cropgraph pest-intel colorado-potato-beetle --json",
      ].join("\n"),
    )
    .action(
      async (pestArg: string, opts: { plant?: string; json?: boolean }) => {
        const pestSlug = pestArg.trim().toLowerCase();
        if (!pestSlug) return fail("pest slug is required.");
        const plantSlug = opts.plant ? resolvePlantArg(opts.plant) : undefined;
        if (opts.plant && !plantSlug) {
          return fail(`no crop calendar match for "${opts.plant}".`);
        }
        const report = getPestIntelligence(pestSlug, plantSlug);
        if (!report) {
          return fail(`no pest or disease entry for "${pestArg}".`);
        }
        if (opts.json) return printJson(report);
        console.log(formatPestIntelligence(report));
      },
    );
}

export function buildBeneficialCommand(): Command {
  return new Command("beneficial")
    .description(
      "Show the full detail page for a beneficial insect, microbe, or friend-not-foe invertebrate: identification cues, garden role, habitat needs, attractor plants, crops it protects via prey relationships, and concrete protection tips for keeping the population resident.",
    )
    .argument("<insect>", "Beneficial slug (e.g. seven-spotted-ladybug, braconid-wasp-cotesia-congregata, mason-bee-pure-green)")
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph beneficial seven-spotted-ladybug",
        "  $ cropgraph beneficial braconid-wasp-cotesia-congregata",
        "  $ cropgraph beneficial blue-orchard-mason-bee --json",
      ].join("\n"),
    )
    .action(
      async (insectArg: string, opts: { json?: boolean }) => {
        const slug = insectArg.trim().toLowerCase();
        if (!slug) return fail("beneficial slug is required.");
        const insect = getBeneficialInsect(slug);
        if (!insect) {
          const verdict = getVerdictForInsect(slug);
          if (verdict === "neutral") {
            return fail(`no beneficial insect entry for "${insectArg}".`);
          }
          return fail(
            `"${insectArg}" is recorded as a ${verdict} (pest), not a beneficial. Try \`cropgraph pest-intel ${slug}\`.`,
          );
        }
        const report = getBeneficialIntelligence(slug);
        if (!report) return fail(`no detail available for "${insectArg}".`);
        if (opts.json) return printJson(report);
        console.log(formatBeneficialDetail(report));
      },
    );
}

export function buildBeneficialsCommand(): Command {
  return new Command("beneficials")
    .description(
      "Browse the beneficial insect database: predators, parasitoids, pollinators, decomposers, and microbial controls. Optional --category filter narrows to one functional grouping.",
    )
    .option(
      "-c, --category <name>",
      `Filter by category. One of: ${VALID_CATEGORIES.join(", ")}.`,
    )
    .option("--json", "Print raw JSON")
    .addHelpText(
      "after",
      [
        "",
        "Examples:",
        "  $ cropgraph beneficials",
        "  $ cropgraph beneficials --category predator",
        "  $ cropgraph beneficials --category microbial-control --json",
      ].join("\n"),
    )
    .action(
      async (opts: { category?: string; json?: boolean }) => {
        let category: BeneficialCategory | undefined;
        if (opts.category) {
          if (!VALID_CATEGORIES.includes(opts.category as BeneficialCategory)) {
            return fail(
              `unknown category "${opts.category}". Must be one of: ${VALID_CATEGORIES.join(", ")}.`,
            );
          }
          category = opts.category as BeneficialCategory;
        }
        const list = listBeneficials(category);
        if (opts.json) return printJson({ count: list.length, entries: list });
        console.log(formatBeneficialsList(list, category));
      },
    );
}
