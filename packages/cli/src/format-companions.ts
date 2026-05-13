import {
  findCrop,
  type BedCompatibilityReport,
  type CompanionEntry,
  type CompanionMechanism,
} from "@cropgraph/core";
import pc from "picocolors";

const MECHANISM_LABEL: Record<CompanionMechanism, string> = {
  nitrogen_fixing: "nitrogen fixing",
  pest_repellent: "pest repellent",
  trap_crop: "trap crop",
  pollinator_attractor: "pollinator attractor",
  shade_provider: "shade provider",
  ground_cover: "ground cover",
  allelopathic: "allelopathic",
  disease_vector: "disease vector",
  nutrient_competition: "nutrient competition",
  space_efficiency: "space efficiency",
  flavor_enhancement: "flavor enhancement",
  structural_support: "structural support",
};

const STRENGTH_TAG: Record<string, string> = {
  strong: pc.green("strong"),
  moderate: pc.cyan("moderate"),
  weak: pc.dim("weak"),
};

function commonName(slug: string): string {
  return findCrop(slug)?.commonName ?? slug;
}

function mechanism(e: CompanionEntry): string {
  return MECHANISM_LABEL[e.mechanism] ?? e.mechanism;
}

function entryLine(e: CompanionEntry, subjectIsCrop: boolean): string {
  const partner = subjectIsCrop ? e.companion : e.crop;
  const name = pc.bold(commonName(partner));
  const mech = pc.cyan(mechanism(e));
  const strength = STRENGTH_TAG[e.strength] ?? e.strength;
  return `  ${name} ,  ${mech}  (${strength})`;
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

export function formatCompanionsBlock(
  slug: string,
  data: { companions: CompanionEntry[]; antagonists: CompanionEntry[] },
): string {
  const out: string[] = [];
  const name = commonName(slug);
  out.push(pc.bold(`🌱 ${name} companions`));
  out.push("");

  if (data.companions.length === 0) {
    out.push(pc.dim("  No companion relationships in the fixture yet."));
  } else {
    out.push(pc.bold("Plant with:"));
    for (const e of data.companions) {
      out.push(entryLine(e, e.crop === slug));
      if (e.description) {
        out.push(pc.dim(`      ${truncate(e.description, 140)}`));
      }
    }
  }

  if (data.antagonists.length > 0) {
    out.push("");
    out.push(pc.bold("Keep away from:"));
    for (const e of data.antagonists) {
      out.push(entryLine(e, e.crop === slug));
      if (e.description) {
        out.push(pc.dim(`      ${truncate(e.description, 140)}`));
      }
    }
  }
  return out.join("\n");
}

export function formatCheckBlock(
  slugA: string,
  slugB: string,
  entry: CompanionEntry | undefined,
): string {
  const a = commonName(slugA);
  const b = commonName(slugB);
  if (!entry) {
    return `${pc.bold(`${a} + ${b}`)}: ${pc.dim("no known relationship")}`;
  }
  const lines: string[] = [];
  if (entry.type === "beneficial") {
    lines.push(`${pc.bold(`${a} + ${b}`)}: ${pc.green("✅ beneficial")}`);
  } else {
    lines.push(`${pc.bold(`${a} + ${b}`)}: ${pc.red("❌ antagonist")}`);
  }
  const strength = STRENGTH_TAG[entry.strength] ?? entry.strength;
  lines.push(`  Mechanism: ${pc.cyan(mechanism(entry))} (${strength})`);
  lines.push(`  ${entry.description}`);
  if (entry.source) {
    lines.push(pc.dim(`  Source: ${entry.source}`));
  }
  return lines.join("\n");
}

export function formatPlanBlock(report: BedCompatibilityReport): string {
  const out: string[] = [];
  const cropList = report.crops.map(commonName).join(", ");
  out.push(pc.bold(`🌱 Bed compatibility: ${cropList}`));
  out.push("");

  const benCount = report.beneficial.length;
  const antCount = report.antagonist.length;
  const benLine = `${pc.green("✅")} ${benCount} beneficial relationship${benCount === 1 ? "" : "s"} found`;
  const antLine =
    antCount === 0
      ? `${pc.green("✅")} 0 antagonist conflicts`
      : `${pc.red("❌")} ${antCount} antagonist conflict${antCount === 1 ? "" : "s"}`;
  out.push(`  ${benLine}`);
  out.push(`  ${antLine}`);

  if (report.beneficial.length > 0) {
    out.push("");
    out.push(pc.bold("Beneficial pairings:"));
    for (const e of report.beneficial) {
      const strength = STRENGTH_TAG[e.strength] ?? e.strength;
      out.push(
        `  ${pc.bold(commonName(e.crop))} + ${pc.bold(commonName(e.companion))} ,  ${pc.cyan(mechanism(e))} (${strength})`,
      );
    }
  }

  if (report.antagonist.length > 0) {
    out.push("");
    out.push(pc.bold("Antagonist conflicts:"));
    for (const e of report.antagonist) {
      const strength = STRENGTH_TAG[e.strength] ?? e.strength;
      out.push(
        `  ${pc.bold(commonName(e.crop))} ${pc.red("vs")} ${pc.bold(commonName(e.companion))} ,  ${pc.cyan(mechanism(e))} (${strength})`,
      );
    }
  }

  if (report.warnings.length > 0) {
    out.push("");
    for (const w of report.warnings) {
      out.push(`  ${pc.yellow("⚠")}  ${w}`);
    }
  }
  return out.join("\n");
}
