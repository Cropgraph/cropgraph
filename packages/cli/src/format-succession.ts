import {
  findCrop,
  type SuccessionCategory,
  type SuccessionChain,
  type SuccessionPlan,
  type SuccessionSowMethod,
} from "@cropgraph/core";
import pc from "picocolors";

const CATEGORY_LABEL: Record<SuccessionCategory, string> = {
  "continuous-harvest": "Continuous harvest",
  "root-succession": "Root succession",
  "legume-succession": "Legume succession",
  "brassica-succession": "Brassica succession",
  "cucurbit-relay": "Cucurbit relay",
  "herb-succession": "Herb succession",
  "flower-succession": "Flower succession",
  "cover-crop-relay": "Cover crop relay",
};

const METHOD_LABEL: Record<SuccessionSowMethod, string> = {
  direct_sow: "direct sow",
  transplant: "transplant",
  start_indoors: "start indoors",
};

function commonName(slug: string): string {
  return findCrop(slug)?.commonName ?? slug;
}

function relativeDayLabel(days: number): string {
  if (days === 0) return "at last spring frost";
  if (days < 0) return `${Math.abs(days)} day${Math.abs(days) === 1 ? "" : "s"} before last spring frost`;
  return `${days} day${days === 1 ? "" : "s"} after last spring frost`;
}

export function formatSuccessionChainBlock(chain: SuccessionChain): string {
  const out: string[] = [];
  out.push(
    pc.bold(
      `🌱 ${commonName(chain.primaryCrop)} succession (${CATEGORY_LABEL[chain.category]}, ${chain.chains.length} phase${chain.chains.length === 1 ? "" : "s"})`,
    ),
  );
  out.push("");
  for (const phase of chain.chains) {
    const interval = phase.intervalWeeks
      ? `, every ${phase.intervalWeeks} week${phase.intervalWeeks === 1 ? "" : "s"}`
      : "";
    out.push(
      `  ${pc.bold(`Phase ${phase.phase}:`)} ${pc.cyan(commonName(phase.crop))}, ${METHOD_LABEL[phase.sowMethod]}${interval}`,
    );
    out.push(
      `    ${pc.dim(`window:`)} ${relativeDayLabel(phase.startRelativeToFrost)} → ${relativeDayLabel(phase.endRelativeToFrost)}`,
    );
    if (phase.notes) out.push(`    ${pc.dim(phase.notes)}`);
    if (phase.climateNotes) {
      for (const [climate, note] of Object.entries(phase.climateNotes)) {
        if (!note) continue;
        out.push(`    ${pc.dim(`${climate}:`)} ${pc.dim(note)}`);
      }
    }
  }
  out.push("");
  out.push(pc.dim(`Source: ${chain.source}`));
  return out.join("\n");
}

export function formatSuccessionPlanBlock(plan: SuccessionPlan): string {
  const out: string[] = [];
  const climate = plan.climateType ? ` · ${plan.climateType}` : "";
  out.push(
    pc.bold(
      `🌱 ${commonName(plan.chain.primaryCrop)} succession plan (${plan.zone.zone}${climate}, ${plan.year})`,
    ),
  );
  out.push(
    pc.dim(
      `  Last spring frost ~ ${plan.frostDates.lastSpring}, first fall frost ~ ${plan.frostDates.firstFall}`,
    ),
  );
  out.push("");
  for (const phase of plan.phases) {
    const interval = phase.intervalWeeks
      ? `, every ${phase.intervalWeeks} week${phase.intervalWeeks === 1 ? "" : "s"}`
      : "";
    out.push(
      `  ${pc.bold(`Phase ${phase.phase}:`)} ${pc.cyan(commonName(phase.crop))}, ${METHOD_LABEL[phase.sowMethod]}${interval}`,
    );
    out.push(
      `    ${pc.dim(`window:`)} ${phase.windowStart} → ${phase.windowEnd}`,
    );
    if (phase.sowingDates.length > 1) {
      const preview = phase.sowingDates.slice(0, 6).join(", ");
      const more =
        phase.sowingDates.length > 6
          ? ` (+${phase.sowingDates.length - 6} more)`
          : "";
      out.push(`    ${pc.dim(`sowings:`)} ${preview}${more}`);
    }
    if (phase.climateNote) out.push(`    ${pc.dim(phase.climateNote)}`);
    else if (phase.notes) out.push(`    ${pc.dim(phase.notes)}`);
  }
  out.push("");
  out.push(pc.dim(`Source: ${plan.chain.source}`));
  return out.join("\n");
}
