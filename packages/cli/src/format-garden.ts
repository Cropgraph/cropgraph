import {
  describeClimateType,
  type ClimateType,
  type CropEntry,
  type FrostDates,
  type PlantSuggestion,
  type ZoneInfo,
} from "@cropgraph/core";
import pc from "picocolors";

function padEnd(s: string, width: number): string {
  return s.length >= width ? s : s + " ".repeat(width - s.length);
}

function truncate(s: string, max: number): string {
  return s.length <= max ? s : `${s.slice(0, max - 1)}…`;
}

// ---------------------------------------------------------------------------
// Zone summary block
// ---------------------------------------------------------------------------

export function formatClimateLine(climate: ClimateType): string {
  const label = climate.replace(/_/g, " ");
  return `${pc.bold("Climate")}  ·  ${label}\n${pc.dim(`  ${describeClimateType(climate)}`)}`;
}

export function formatZoneBlock(
  zone: ZoneInfo,
  frost: FrostDates | undefined,
  climate?: ClimateType,
): string {
  const lines: string[] = [];
  const titleColor = pc.bold(`USDA Zone ${zone.zone}`);
  const tempLine = `${zone.minTempF}°F to ${zone.maxTempF}°F (avg annual min winter temp)`;
  const climateChip = climate ? `  ·  ${pc.cyan(climate.replace(/_/g, " "))}` : "";
  lines.push(`${titleColor}  ·  ${tempLine}${climateChip}`);
  if (zone.resolvedFrom === "coords-nearest") {
    const distNote =
      typeof zone.distanceKm === "number"
        ? `${zone.distanceKm} km away`
        : "approximate";
    lines.push(pc.dim(`  resolved from nearest ZIP ${zone.zip} (${distNote})`));
  } else {
    lines.push(pc.dim(`  ZIP ${zone.zip} · exact match`));
  }
  if (frost) {
    lines.push("");
    lines.push(`${pc.bold("Typical frost dates")}:`);
    lines.push(
      `  last spring frost  ~${frost.lastSpring}   ·  first fall frost  ~${frost.firstFall}`,
    );
    lines.push(
      pc.dim(
        `  growing season ~${frost.seasonDays} days (continental US average; coastal/mountain microclimates may shift 2-3 weeks)`,
      ),
    );
  }
  if (climate) {
    lines.push("");
    lines.push(formatClimateLine(climate));
  }
  return lines.join("\n");
}

// ---------------------------------------------------------------------------
// Planting plan rows
// ---------------------------------------------------------------------------

const ACTION_LABEL: Record<string, string> = {
  start_indoors: "start indoors",
  direct_sow: "direct sow",
  transplant: "transplant",
  plant_now: "plant now",
};

const ACTION_ICON: Record<string, string> = {
  start_indoors: "🪴",
  direct_sow: "🌱",
  transplant: "🌿",
  plant_now: "🌳",
};

export function formatPlantSuggestion(
  s: PlantSuggestion,
  showNotes = false,
): string {
  const action = pc.cyan(padEnd(ACTION_LABEL[s.action] ?? s.action, 13));
  const name = pc.bold(padEnd(truncate(s.commonName, 22), 22));
  const window = pc.dim(`${s.windowStart}…${s.windowEnd}`);
  const harvest = s.expectedHarvestEarliest
    ? `harvest ${pc.dim("≥")} ${s.expectedHarvestEarliest}`
    : "";
  const head = `  ${ACTION_ICON[s.action] ?? "·"} ${action} ${name}  ${window}  ${harvest}`;
  if (showNotes && s.notes) {
    return `${head}\n      ${pc.dim(truncate(s.notes, 140))}`;
  }
  return head;
}

export function formatPlantingPlan(
  zone: ZoneInfo,
  frost: FrostDates,
  asOf: string,
  plantNow: PlantSuggestion[],
  climate?: ClimateType,
): string {
  const out: string[] = [];
  out.push(formatZoneBlock(zone, frost, climate));
  out.push("");
  const climateChip = climate
    ? `  ·  ${pc.cyan(climate.replace(/_/g, " "))}`
    : "";
  out.push(
    pc.bold(
      `🌱 Plant now in zone ${zone.zone}${climateChip}  ·  ${asOf}  ·  ${plantNow.length} option${plantNow.length === 1 ? "" : "s"}`,
    ),
  );
  if (plantNow.length === 0) {
    out.push(
      pc.dim(
        "  Nothing in window today. Try `cropgraph zone` to see frost dates and plan ahead.",
      ),
    );
    return out.join("\n");
  }
  out.push("");
  const groups = new Map<string, PlantSuggestion[]>();
  for (const s of plantNow) {
    const arr = groups.get(s.action);
    if (arr) arr.push(s);
    else groups.set(s.action, [s]);
  }
  for (const action of [
    "start_indoors",
    "direct_sow",
    "transplant",
    "plant_now",
  ]) {
    const arr = groups.get(action);
    if (!arr || arr.length === 0) continue;
    for (const s of arr) out.push(formatPlantSuggestion(s, climate !== undefined));
    out.push("");
  }
  return out.join("\n").trimEnd();
}

// ---------------------------------------------------------------------------
// Crop entry detail
// ---------------------------------------------------------------------------

export function formatCropEntry(crop: CropEntry): string {
  const out: string[] = [];
  out.push(
    `${pc.bold(crop.commonName)}  ·  ${pc.italic(crop.scientificName)}  ·  ${pc.dim(crop.category + " / " + crop.season)}`,
  );
  out.push(
    `  Days to harvest: ${crop.daysToHarvest.min}-${crop.daysToHarvest.max}  ·  Zones: ${crop.zoneRange.min}-${crop.zoneRange.max}` +
      (crop.minSoilTempF != null
        ? `  ·  Min soil ${crop.minSoilTempF}°F`
        : ""),
  );
  out.push("");
  out.push(pc.bold("  Planting windows:"));
  for (const w of crop.windows) {
    const sign = (n: number) => (n >= 0 ? `+${n}` : `${n}`);
    const line = `    ${ACTION_ICON[w.action] ?? "·"} ${pc.cyan(ACTION_LABEL[w.action] ?? w.action)}  ${sign(w.fromFrostDays)}…${sign(w.toFrostDays)} days from ${w.anchor === "last_spring" ? "last spring frost" : "first fall frost"}`;
    out.push(line);
    if (w.notes) out.push(pc.dim(`        ${w.notes}`));
  }
  if (crop.notes) {
    out.push("");
    out.push(`  ${crop.notes}`);
  }
  if (crop.aliases && crop.aliases.length > 0) {
    out.push(pc.dim(`  aliases: ${crop.aliases.join(", ")}`));
  }
  return out.join("\n");
}

// ---------------------------------------------------------------------------
// Crop search summary row
// ---------------------------------------------------------------------------

export function formatCropSummaryRow(c: CropEntry): string {
  const common = padEnd(truncate(c.commonName, 28), 28);
  const sci = pc.italic(padEnd(truncate(c.scientificName, 38), 38));
  const cat = pc.dim(`${c.category}/${c.season}`);
  return `  ${common}  ${sci}  ${cat}`;
}
