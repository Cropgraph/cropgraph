import {
  findCrop,
  type PestDetailReport,
  type PestDiseaseEntry,
  type PestSeverity,
} from "@cropgraph/core";
import pc from "picocolors";

const SEVERITY_TAG: Record<PestSeverity, (s: string) => string> = {
  severe: pc.red,
  high: pc.red,
  moderate: pc.yellow,
  low: pc.dim,
};

function commonName(slug: string): string {
  return findCrop(slug)?.commonName ?? slug;
}

function severityTag(s: PestSeverity): string {
  return SEVERITY_TAG[s](s);
}

function pestLabel(pest: string): string {
  return pest
    .split("-")
    .map((p) => p.charAt(0).toUpperCase() + p.slice(1))
    .join(" ");
}

export function formatPestsBlock(
  cropSlug: string,
  entries: PestDiseaseEntry[],
): string {
  const out: string[] = [];
  out.push(
    pc.bold(
      `🐛 ${commonName(cropSlug)} pests and diseases (${entries.length})`,
    ),
  );
  out.push("");
  if (entries.length === 0) {
    out.push(pc.dim("  No entries in the fixture for this crop yet."));
    return out.join("\n");
  }
  for (const e of entries) {
    const tag = e.type === "pest" ? pc.cyan("pest") : pc.magenta("disease");
    out.push(
      `  ${pc.bold(pestLabel(e.pest))} ${tag} ${severityTag(e.severity)}`,
    );
    out.push(`    ${pc.dim(e.symptoms)}`);
    if (e.organicManagement.length > 0) {
      out.push(`    ${pc.cyan("Manage:")} ${e.organicManagement[0]}`);
      for (const m of e.organicManagement.slice(1)) {
        out.push(`            ${m}`);
      }
    }
    out.push(`    ${pc.cyan("Prevent:")} ${e.prevention}`);
    out.push(`    ${pc.dim(`Regions: ${e.regions.join(", ")} | Source: ${e.source}`)}`);
    out.push("");
  }
  return out.join("\n").trimEnd();
}

export function formatPestDetailBlock(detail: PestDetailReport): string {
  const out: string[] = [];
  const tag = detail.type === "pest" ? pc.cyan("pest") : pc.magenta("disease");
  out.push(
    pc.bold(`🐛 ${pestLabel(detail.pest)} ${tag}`),
  );
  out.push(
    `  ${pc.cyan("Severity:")} ${detail.severities.map(severityTag).join(", ")}`,
  );
  out.push(
    `  ${pc.cyan("Regions:")} ${detail.regions.join(", ")}`,
  );
  out.push("");
  out.push(pc.bold(`Affects ${detail.affects.length} crop${detail.affects.length === 1 ? "" : "s"}:`));
  for (const e of detail.affects) {
    out.push(
      `  ${pc.bold(commonName(e.crop))} ${severityTag(e.severity)}`,
    );
    out.push(`    ${pc.dim(e.symptoms)}`);
    out.push(`    ${pc.cyan("Manage:")} ${e.organicManagement[0]}`);
    out.push(`    ${pc.cyan("Prevent:")} ${e.prevention}`);
    out.push(`    ${pc.dim(`Source: ${e.source}`)}`);
    out.push("");
  }
  return out.join("\n").trimEnd();
}
