import {
  findCrop,
  type RotationAdvice,
  type RotationFamilySlug,
  type RotationSequenceReport,
} from "@cropgraph/core";
import pc from "picocolors";

const FAMILY_LABEL: Record<RotationFamilySlug, string> = {
  nightshades: "Nightshades",
  brassicas: "Brassicas",
  cucurbits: "Cucurbits",
  alliums: "Alliums",
  legumes: "Legumes",
  umbellifers: "Umbellifers",
  grasses: "Grasses",
  amaranthaceae: "Beets/Spinach/Amaranth",
  composites: "Lettuce/Composites",
  mints: "Mints",
  malvaceae: "Okra/Mallows",
  miscellaneous: "Miscellaneous",
};

function commonName(slug: string): string {
  return findCrop(slug)?.commonName ?? slug;
}

function familyLabel(f: RotationFamilySlug | "unknown"): string {
  if (f === "unknown") return "unknown";
  return FAMILY_LABEL[f] ?? f;
}

export function formatRotationBlock(
  advice: RotationAdvice,
  partners: {
    follow: { family: RotationFamilySlug; crops: string[] }[];
    avoid: { family: RotationFamilySlug; crops: string[] }[];
  },
): string {
  const out: string[] = [];
  out.push(
    pc.bold(
      `🔄 ${commonName(advice.slug)} (${familyLabel(advice.family)} family, ${advice.scientificFamily})`,
    ),
  );
  out.push("");
  if (advice.rotationYears > 0) {
    out.push(
      `  ${pc.cyan("Rotate:")} ${advice.rotationYears}-year gap before planting another ${familyLabel(advice.family).toLowerCase()} in the same bed`,
    );
  } else {
    out.push(
      `  ${pc.cyan("Rotate:")} no family-level rule (perennial or crop-specific; check the calendar notes)`,
    );
  }

  if (advice.followWith.length > 0) {
    out.push(
      `  ${pc.green("Follow with:")} ${advice.followWith.map(familyLabel).join(", ")}`,
    );
  }
  if (advice.neverFollow.length > 0) {
    out.push(
      `  ${pc.red("Never follow:")} ${advice.neverFollow.map(familyLabel).join(", ")}`,
    );
  }

  if (partners.follow.length > 0) {
    out.push("");
    out.push(pc.bold("Good rotation partners:"));
    for (const p of partners.follow) {
      const sample = p.crops.slice(0, 4).map(commonName).join(", ");
      const more =
        p.crops.length > 4 ? ` (+${p.crops.length - 4} more)` : "";
      out.push(`  ${pc.cyan(familyLabel(p.family))}: ${sample}${more}`);
    }
  }

  if (partners.avoid.length > 0) {
    out.push("");
    out.push(pc.bold("Avoid following with:"));
    for (const p of partners.avoid) {
      const sample = p.crops.slice(0, 4).map(commonName).join(", ");
      const more =
        p.crops.length > 4 ? ` (+${p.crops.length - 4} more)` : "";
      out.push(`  ${pc.red(familyLabel(p.family))}: ${sample}${more}`);
    }
  }

  out.push("");
  out.push(pc.dim(advice.reason));
  out.push(pc.dim(`Source: ${advice.source}`));
  return out.join("\n");
}

export function formatRotationSequenceBlock(
  report: RotationSequenceReport,
): string {
  const out: string[] = [];
  out.push(pc.bold("🔄 Rotation sequence check"));
  out.push("");
  report.sequence.forEach((s, i) => {
    out.push(
      `  Year ${i + 1}: ${pc.bold(commonName(s.slug))} (${familyLabel(s.family)})`,
    );
  });
  out.push("");
  if (report.ok) {
    out.push(`  ${pc.green("✅ OK,")} no rotation violations detected`);
  } else {
    const violations = report.issues.filter((i) => i.severity === "violation").length;
    const warnings = report.issues.filter((i) => i.severity === "warning").length;
    out.push(
      `  ${pc.red("❌")} ${violations} violation${violations === 1 ? "" : "s"}, ${pc.yellow("⚠")}  ${warnings} warning${warnings === 1 ? "" : "s"}`,
    );
    out.push("");
    for (const issue of report.issues) {
      const tag =
        issue.severity === "violation"
          ? pc.red("violation")
          : pc.yellow("warning");
      out.push(`  ${tag}: ${issue.message}`);
    }
  }
  return out.join("\n");
}
