// Composite pest and beneficial intelligence layer. Joins pest-disease,
// beneficial-insects, pest-beneficial-map, pest-companion-map, and rotation
// into single "now what?" reports for any pest or beneficial slug.
//
// This is the layer that powers the consumer garden pest-identification
// answer: after the photo is identified as a tomato hornworm on a tomato,
// `getPestIntelligence("tomato-hornworm", "tomato")` returns the immediate
// action steps, companion deterrents, beneficial predators, rotation
// implications, and the friendly-lookalike list in one shape.

import { z } from "zod";
import beneficialMapRaw from "./data/pest-beneficial-map.json" with { type: "json" };
import companionMapRaw from "./data/pest-companion-map.json" with { type: "json" };
import {
  getBeneficialInsect,
  getBeneficialsForPest,
  getBeneficialsAttractedBy,
  type BeneficialInsect,
} from "./beneficial-insects.js";
import { findCrop } from "./crop-calendar.js";
import { getCompanions, type CompanionEntry } from "./companions.js";
import {
  getOrganicManagement,
  getPestDetail,
  type PestDetailReport,
  type PestDiseaseEntry,
  type PestSeverity,
} from "./pest-disease.js";
import { getRotationAdvice, type RotationAdvice } from "./rotation.js";

// ---------------------------------------------------------------------------
// Loaders for the two derived maps. Both have light shapes; we parse them
// strictly to catch curation bugs at module load.
// ---------------------------------------------------------------------------

const PestBeneficialEntrySchema = z.object({
  pest: z.string(),
  predators: z.array(z.string()),
  parasitoids: z.array(z.string()),
  microbials: z.array(z.string()),
  note: z.string().nullable(),
});
type PestBeneficialMapEntry = z.infer<typeof PestBeneficialEntrySchema>;

const PestBeneficialFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(PestBeneficialEntrySchema),
});

const PestCompanionEntrySchema = z.object({
  pest: z.string(),
  deterredBy: z.array(z.string()),
  trappedBy: z.array(z.string()),
  affectedHosts: z.array(z.string()),
  note: z.string(),
});
type PestCompanionMapEntry = z.infer<typeof PestCompanionEntrySchema>;

const PestCompanionFileSchema = z.object({
  version: z.string(),
  source: z.string(),
  license: z.string(),
  lastUpdated: z.string().optional(),
  entries: z.array(PestCompanionEntrySchema),
});

let BENEFICIAL_MAP: Map<string, PestBeneficialMapEntry> | null = null;
let COMPANION_MAP: Map<string, PestCompanionMapEntry> | null = null;

function loadBeneficialMap(): Map<string, PestBeneficialMapEntry> {
  if (BENEFICIAL_MAP) return BENEFICIAL_MAP;
  const parsed = PestBeneficialFileSchema.safeParse(beneficialMapRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `pest-beneficial-map.json failed validation at ${issue?.path.join(".") ?? "(root)"}: ${issue?.message ?? "unknown"}`,
    );
  }
  const map = new Map<string, PestBeneficialMapEntry>();
  for (const e of parsed.data.entries) map.set(e.pest, e);
  BENEFICIAL_MAP = map;
  return map;
}

function loadCompanionMap(): Map<string, PestCompanionMapEntry> {
  if (COMPANION_MAP) return COMPANION_MAP;
  const parsed = PestCompanionFileSchema.safeParse(companionMapRaw);
  if (!parsed.success) {
    const issue = parsed.error.issues[0];
    throw new Error(
      `pest-companion-map.json failed validation at ${issue?.path.join(".") ?? "(root)"}: ${issue?.message ?? "unknown"}`,
    );
  }
  const map = new Map<string, PestCompanionMapEntry>();
  for (const e of parsed.data.entries) map.set(e.pest, e);
  COMPANION_MAP = map;
  return map;
}

// ---------------------------------------------------------------------------
// Verdict logic
// ---------------------------------------------------------------------------

export type InsectVerdict = "friend" | "foe" | "nuisance" | "cosmetic" | "neutral";

const VERDICT_FROM_SEVERITY: Record<PestSeverity, "foe" | "nuisance" | "cosmetic"> = {
  severe: "foe",
  high: "foe",
  moderate: "nuisance",
  low: "cosmetic",
};

function aggregateVerdict(report: PestDetailReport): "foe" | "nuisance" | "cosmetic" {
  const top = report.severities[0];
  if (!top) return "cosmetic";
  return VERDICT_FROM_SEVERITY[top];
}

/** Quickly classify any insect slug as friend, foe, or neutral by checking the
 *  beneficial database first, then the pest/disease database. */
export function getVerdictForInsect(slug: string): InsectVerdict {
  if (getBeneficialInsect(slug)) return "friend";
  const pest = getPestDetail(slug);
  if (pest) return aggregateVerdict(pest);
  return "neutral";
}

// ---------------------------------------------------------------------------
// Pest intelligence
// ---------------------------------------------------------------------------

export interface CompanionDeterrentReport {
  plant: string;
  mechanism: "pest_repellent" | "trap_crop";
  description: string;
  strength: string;
  source: string;
}

export interface BeneficialPredatorReport {
  slug: string;
  commonName: string;
  scientificName: string;
  role: "predator" | "parasitoid" | "microbial-control";
  gardenRole: string;
  identificationTips: string;
}

export interface FriendlyLookalikeReport {
  slug: string;
  commonName: string;
  confusionNote: string;
}

export interface PestIntelligenceReport {
  pest: PestDetailReport;
  /** Single-crop entry when `plantSlug` was provided and a match exists. */
  cropSpecific?: PestDiseaseEntry;
  severity: PestSeverity;
  verdict: "foe" | "nuisance" | "cosmetic";
  immediateAction: string[];
  seasonalPrevention: string[];
  companionDeterrents: CompanionDeterrentReport[];
  beneficialPredators: BeneficialPredatorReport[];
  /** Population-level guidance from the pest-beneficial-map note. */
  beneficialNote: string | null;
  /** Population-level guidance from the pest-companion-map note. */
  companionNote: string | null;
  rotationAdvice?: RotationAdvice;
  friendlyLookalikes: FriendlyLookalikeReport[];
}

function dedupeCompanions(
  entries: CompanionEntry[],
): CompanionDeterrentReport[] {
  const seen = new Set<string>();
  const out: CompanionDeterrentReport[] = [];
  for (const e of entries) {
    if (e.mechanism !== "pest_repellent" && e.mechanism !== "trap_crop") continue;
    const key = `${e.companion}|${e.mechanism}`;
    if (seen.has(key)) continue;
    seen.add(key);
    out.push({
      plant: e.companion,
      mechanism: e.mechanism,
      description: e.description,
      strength: e.strength,
      source: e.source,
    });
  }
  return out;
}

function lookalikesFor(pestSlug: string): FriendlyLookalikeReport[] {
  const out: FriendlyLookalikeReport[] = [];
  const beneficials = getBeneficialsForPest(pestSlug);
  for (const b of beneficials) {
    if (b.confusedWith && b.confusionNote) {
      out.push({
        slug: b.slug,
        commonName: b.commonName,
        confusionNote: b.confusionNote,
      });
    }
  }
  return out;
}

/** Composite "now what?" report for a pest slug. When `plantSlug` is provided
 *  the report includes the crop-specific pest entry and the companion
 *  relationships for that crop. */
export function getPestIntelligence(
  pestSlug: string,
  plantSlug?: string,
): PestIntelligenceReport | undefined {
  const pest = getPestDetail(pestSlug);
  if (!pest) return undefined;

  const beneficialMap = loadBeneficialMap();
  const companionMap = loadCompanionMap();

  const cropSpecific = plantSlug
    ? getOrganicManagement(plantSlug, pestSlug)
    : undefined;

  const severity = pest.severities[0] ?? "low";
  const verdict = VERDICT_FROM_SEVERITY[severity];

  const sourceEntry = cropSpecific ?? pest.affects[0]!;
  const immediateAction = sourceEntry.organicManagement.slice();
  const seasonalPrevention = sourceEntry.prevention
    .split(/\.\s+(?=[A-Z])/)
    .map((s) => s.trim())
    .filter((s) => s.length > 0)
    .map((s) => (s.endsWith(".") ? s : `${s}.`));

  let companionDeterrents: CompanionDeterrentReport[] = [];
  if (plantSlug) {
    const plantCompanions = getCompanions(plantSlug);
    companionDeterrents = dedupeCompanions(plantCompanions.companions);
  }
  const companionEntry = companionMap.get(pestSlug);
  if (companionDeterrents.length === 0 && companionEntry) {
    for (const plant of companionEntry.deterredBy) {
      companionDeterrents.push({
        plant,
        mechanism: "pest_repellent",
        description: "",
        strength: "moderate",
        source: "Derived from companions.json mechanism mapping.",
      });
    }
    for (const plant of companionEntry.trappedBy) {
      companionDeterrents.push({
        plant,
        mechanism: "trap_crop",
        description: "",
        strength: "moderate",
        source: "Derived from companions.json mechanism mapping.",
      });
    }
  }

  const beneficialEntry = beneficialMap.get(pestSlug);
  const beneficials = getBeneficialsForPest(pestSlug);
  const beneficialPredators: BeneficialPredatorReport[] = beneficials.map(
    (b: BeneficialInsect) => ({
      slug: b.slug,
      commonName: b.commonName,
      scientificName: b.scientificName,
      role: b.category as "predator" | "parasitoid" | "microbial-control",
      gardenRole: b.gardenRole,
      identificationTips: b.identificationTips,
    }),
  );

  // Rotation lookup is defensive: an unrelated curation gap in
  // rotation-families.json would otherwise cascade into every pest-intel
  // call. When rotation cannot resolve, we omit the rotationAdvice field.
  let rotation: RotationAdvice | undefined;
  if (plantSlug) {
    try {
      rotation = getRotationAdvice(plantSlug);
    } catch {
      rotation = undefined;
    }
  }

  const out: PestIntelligenceReport = {
    pest,
    severity,
    verdict,
    immediateAction,
    seasonalPrevention,
    companionDeterrents,
    beneficialPredators,
    beneficialNote: beneficialEntry?.note ?? null,
    companionNote: companionEntry?.note ?? null,
    friendlyLookalikes: lookalikesFor(pestSlug),
  };
  if (cropSpecific) out.cropSpecific = cropSpecific;
  if (rotation) out.rotationAdvice = rotation;
  return out;
}

// ---------------------------------------------------------------------------
// Beneficial intelligence
// ---------------------------------------------------------------------------

export interface ProtectedCropReport {
  crop: string;
  commonName: string;
  via: string[];
}

export interface BeneficialIntelligenceReport {
  insect: BeneficialInsect;
  verdict: "friend";
  gardenRole: string;
  attractedBy: { slug: string; commonName: string }[];
  protects: ProtectedCropReport[];
  protectionTips: string[];
}

/** Composite report for a beneficial insect slug: identification, the plants
 *  that attract it, the crops it protects via prey relationships, and
 *  practical tips for keeping it in the garden. */
export function getBeneficialIntelligence(
  insectSlug: string,
): BeneficialIntelligenceReport | undefined {
  const insect = getBeneficialInsect(insectSlug);
  if (!insect) return undefined;

  const attracted = insect.attractedBy.map((slug) => {
    const crop = findCrop(slug);
    return { slug, commonName: crop?.commonName ?? slug };
  });

  const protectedMap = new Map<string, Set<string>>();
  for (const pest of insect.preyOn) {
    const detail = getPestDetail(pest);
    if (!detail) continue;
    for (const affected of detail.affects) {
      let set = protectedMap.get(affected.crop);
      if (!set) {
        set = new Set<string>();
        protectedMap.set(affected.crop, set);
      }
      set.add(pest);
    }
  }
  const protects: ProtectedCropReport[] = Array.from(protectedMap.entries())
    .map(([crop, viaSet]) => ({
      crop,
      commonName: findCrop(crop)?.commonName ?? crop,
      via: Array.from(viaSet).sort(),
    }))
    .sort((a, b) => b.via.length - a.via.length || a.crop.localeCompare(b.crop));

  const protectionTips: string[] = [
    insect.habitatNeeds,
    insect.attractedBy.length > 0
      ? `Plant ${insect.attractedBy.slice(0, 4).join(", ")} as nearby nectar or pollen sources.`
      : "Provide diverse small-flowered nectar plants nearby.",
    "Avoid broad-spectrum insecticides, which kill this beneficial alongside its target pests.",
  ];

  return {
    insect,
    verdict: "friend",
    gardenRole: insect.gardenRole,
    attractedBy: attracted,
    protects,
    protectionTips,
  };
}
