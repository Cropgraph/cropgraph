import {
  type BeneficialCategory,
  type BeneficialInsect,
  type BeneficialIntelligenceReport,
  type PestIntelligenceReport,
} from "@cropgraph/core";
import pc from "picocolors";

const CATEGORY_COLOR: Record<BeneficialCategory, (s: string) => string> = {
  predator: pc.cyan,
  parasitoid: pc.magenta,
  pollinator: pc.yellow,
  decomposer: pc.green,
  "microbial-control": pc.blue,
};

function categoryTag(c: BeneficialCategory): string {
  return CATEGORY_COLOR[c](c);
}

function verdictTag(verdict: string): string {
  if (verdict === "foe") return pc.red(`foe`);
  if (verdict === "nuisance") return pc.yellow(`nuisance`);
  if (verdict === "cosmetic") return pc.dim(`cosmetic`);
  if (verdict === "friend") return pc.green(`friend`);
  return pc.dim(`neutral`);
}

function pestLabel(pest: string): string {
  return pest
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function formatBeneficialDetail(report: BeneficialIntelligenceReport): string {
  const out: string[] = [];
  const i = report.insect;
  out.push(
    pc.bold(`✨ ${i.commonName} `) +
      pc.dim(`(${i.scientificName})`) +
      ` ${categoryTag(i.category)} ${verdictTag(report.verdict)}`,
  );
  out.push("");
  out.push(pc.bold("Role in the garden:"));
  out.push(`  ${i.gardenRole}`);
  out.push("");
  out.push(pc.bold("Identification:"));
  out.push(`  ${i.identificationTips}`);
  if (i.confusedWith) {
    out.push("");
    out.push(pc.bold(`Often confused with ${pc.cyan(i.confusedWith)}:`));
    out.push(`  ${i.confusionNote ?? ""}`);
  }
  out.push("");
  out.push(pc.bold("Habitat needs:"));
  out.push(`  ${i.habitatNeeds}`);
  if (report.attractedBy.length > 0) {
    out.push("");
    out.push(pc.bold("Attracted by:"));
    for (const a of report.attractedBy) {
      out.push(`  ${pc.cyan("•")} ${a.commonName} ${pc.dim(`(${a.slug})`)}`);
    }
  }
  if (report.protects.length > 0) {
    out.push("");
    out.push(pc.bold(`Protects ${report.protects.length} crops via prey relationships:`));
    for (const p of report.protects.slice(0, 15)) {
      out.push(
        `  ${pc.cyan("•")} ${p.commonName} ${pc.dim(`(via ${p.via.length} pest${p.via.length === 1 ? "" : "s"})`)}`,
      );
    }
    if (report.protects.length > 15) {
      out.push(`  ${pc.dim(`... and ${report.protects.length - 15} more`)}`);
    }
  }
  out.push("");
  out.push(pc.bold("Protection tips:"));
  for (const t of report.protectionTips) {
    out.push(`  ${pc.cyan("•")} ${t}`);
  }
  out.push("");
  out.push(
    pc.dim(
      `Regions: ${i.regions.join(", ")} | Active: ${i.seasonalPresence.active.join(", ")} | Source: ${i.source}`,
    ),
  );
  return out.join("\n").trimEnd();
}

export function formatBeneficialsList(
  list: BeneficialInsect[],
  filter?: BeneficialCategory,
): string {
  const out: string[] = [];
  out.push(
    pc.bold(
      `✨ Beneficial insects (${list.length}${filter ? `, ${filter} only` : ""})`,
    ),
  );
  out.push("");
  if (list.length === 0) {
    out.push(pc.dim("  No entries."));
    return out.join("\n");
  }
  for (const b of list) {
    out.push(
      `  ${pc.bold(b.commonName)} ${pc.dim(`(${b.slug})`)} ${categoryTag(b.category)}`,
    );
    out.push(`    ${pc.dim(b.scientificName)}`);
    out.push(`    ${b.gardenRole.slice(0, 200)}${b.gardenRole.length > 200 ? "…" : ""}`);
    out.push("");
  }
  return out.join("\n").trimEnd();
}

export function formatPestIntelligence(report: PestIntelligenceReport): string {
  const out: string[] = [];
  const p = report.pest;
  out.push(
    pc.bold(`🐛 ${pestLabel(p.pest)} `) +
      pc.dim(`(${p.type})`) +
      ` ${verdictTag(report.verdict)} severity=${report.severity}`,
  );
  out.push("");
  if (report.cropSpecific) {
    out.push(pc.bold("On this crop:"));
    out.push(`  ${report.cropSpecific.symptoms}`);
  } else {
    out.push(pc.bold("Affects:"));
    out.push(`  ${p.affects.map((a) => a.crop).slice(0, 8).join(", ")}${p.affects.length > 8 ? ", …" : ""}`);
  }
  out.push("");
  out.push(pc.bold("Immediate action:"));
  for (const step of report.immediateAction) {
    out.push(`  ${pc.cyan("•")} ${step}`);
  }
  if (report.seasonalPrevention.length > 0) {
    out.push("");
    out.push(pc.bold("Seasonal prevention:"));
    for (const step of report.seasonalPrevention) {
      out.push(`  ${pc.cyan("•")} ${step}`);
    }
  }
  if (report.companionDeterrents.length > 0) {
    out.push("");
    out.push(pc.bold("Companion deterrents:"));
    for (const c of report.companionDeterrents.slice(0, 12)) {
      const tag = c.mechanism === "trap_crop" ? pc.yellow("trap") : pc.green("deters");
      out.push(`  ${tag} ${c.plant}`);
    }
    if (report.companionNote) {
      out.push(`  ${pc.dim(report.companionNote)}`);
    }
  }
  if (report.beneficialPredators.length > 0) {
    out.push("");
    out.push(pc.bold(`Beneficial predators (${report.beneficialPredators.length}):`));
    for (const b of report.beneficialPredators.slice(0, 12)) {
      const tag = CATEGORY_COLOR[b.role](b.role);
      out.push(`  ${tag} ${b.commonName} ${pc.dim(`(${b.slug})`)}`);
    }
    if (report.beneficialPredators.length > 12) {
      out.push(`  ${pc.dim(`... and ${report.beneficialPredators.length - 12} more`)}`);
    }
    if (report.beneficialNote) {
      out.push(`  ${pc.dim(report.beneficialNote)}`);
    }
  }
  if (report.friendlyLookalikes.length > 0) {
    out.push("");
    out.push(pc.bold("Friend-or-foe lookalikes:"));
    for (const l of report.friendlyLookalikes) {
      out.push(`  ${pc.green("friend")} ${l.commonName}`);
      out.push(`    ${pc.dim(l.confusionNote)}`);
    }
  }
  if (report.rotationAdvice) {
    out.push("");
    out.push(pc.bold("Rotation advice:"));
    out.push(`  Family: ${report.rotationAdvice.family}`);
    out.push(`  Years between same family: ${report.rotationAdvice.rotationYears}`);
    if (report.rotationAdvice.followWith.length > 0) {
      out.push(`  Follow with: ${report.rotationAdvice.followWith.join(", ")}`);
    }
  }
  return out.join("\n").trimEnd();
}
