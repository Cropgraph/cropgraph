import type { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import { z } from "zod";
import {
  checkBedCompatibility,
  checkRotationSequence,
  err,
  findCrop,
  getClimateType,
  getCompanions,
  getCropsForZone,
  getFrostDates,
  getHardinessZone,
  getHardinessZoneByZip,
  getPlantingPlan,
  getRelationship,
  getRotationAdvice,
  getRotationPartners,
  getCropsAffected,
  getPestDetail,
  getPestsByCrop,
  getSuccessionChain,
  getSuccessionPlan,
  searchCrops,
  type ClimateType,
  type Coordinates,
  type CropCategory,
  type CropEntry,
  type GardenBriefing,
  type ZoneInfo,
} from "@cropgraph/core";
import { failure, success } from "./respond.js";
import {
  categoryField,
  climateTypeField,
  cropListField,
  cropNameField,
  dateField,
  includeIndoorField,
  latField,
  limitField,
  lngField,
  padDaysField,
  queryField,
  slugOrNameField,
  pestSlugField,
  yearField,
  zipField,
  zoneField,
} from "./schemas.js";

const READ_ONLY = { readOnlyHint: true, openWorldHint: true } as const;
const SOURCE = "cropgraph-mcp";

export function registerAllTools(server: McpServer): void {
  registerGetHardinessZone(server);
  registerGetPlantingPlan(server);
  registerGetCropDetails(server);
  registerSearchPlants(server);
  registerGetCropsForZone(server);
  registerGetCompanions(server);
  registerCheckCompanionPair(server);
  registerPlanBedCompatibility(server);
  registerGetRotationAdvice(server);
  registerCheckRotationSequence(server);
  registerGetSuccessionChain(server);
  registerGetSuccessionPlan(server);
  registerGetCropPests(server);
  registerGetPestDetail(server);
}

// ---------------------------------------------------------------------------
// 1. get_hardiness_zone
// ---------------------------------------------------------------------------

function registerGetHardinessZone(server: McpServer): void {
  server.registerTool(
    "get_hardiness_zone",
    {
      title: "Look up USDA Plant Hardiness Zone",
      description:
        "Returns the USDA hardiness zone (1a..13b) and typical first/last frost dates for a US location. " +
        "Provide either lat+lng (resolves to nearest ZIP centroid in the bundled 40,283-ZIP PRISM 2023 dataset) or a 5-digit zip (exact match when present). " +
        "The zone object includes the 5°F temperature band (min/max winter °F), and frostDates includes lastSpring (MM-DD), firstFall (MM-DD), and seasonDays. " +
        "Coastal, mountain, and desert microclimates can shift frost dates 2-3 weeks from the table; surface this caveat to gardeners. " +
        "No API key required; works fully offline.",
      inputSchema: {
        lat: latField.optional(),
        lng: lngField.optional(),
        zip: zipField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      let zoneRes: ReturnType<typeof getHardinessZone>;
      if (args.zip) {
        zoneRes = getHardinessZoneByZip(args.zip);
      } else if (args.lat !== undefined && args.lng !== undefined) {
        zoneRes = getHardinessZone({ lat: args.lat, lng: args.lng });
      } else {
        return failure({
          source: SOURCE,
          message: "get_hardiness_zone: provide either {lat, lng} or {zip}",
        });
      }
      if (!zoneRes.ok) return failure(zoneRes.error);
      const frost = getFrostDates(zoneRes.data.zone);
      return success({
        zone: zoneRes.data,
        frostDates: frost.ok ? frost.data : null,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 2. get_planting_plan
// ---------------------------------------------------------------------------

function registerGetPlantingPlan(server: McpServer): void {
  server.registerTool(
    "get_planting_plan",
    {
      title: "What to Plant Now (USDA Zone + Frost-Anchored Calendar, Climate-Aware)",
      description:
        "Returns a list of crops to plant in the supplied date window, drawn from the bundled 1000-crop calendar (USDA Cooperative Extension publications). " +
        "Provide a USDA zone string ('5b', '8b') OR a coordinate pair / zip; coordinates resolve to a zone via the same lookup as `get_hardiness_zone`. " +
        "Each suggestion has: action (start_indoors / direct_sow / transplant / plant_now), windowStart..windowEnd (ISO dates anchored to the zone's typical frost dates), daysToHarvest range, and expectedHarvestEarliest. " +
        "If expectedHarvestEarliest lands past the typical first fall frost the crop is unlikely to finish; surface that to the user. " +
        "Climate-aware: pass `climate_type` to apply per-climate window shifts and notes. When you supply lat/lng or zip without `climate_type`, the tool auto-detects the climate from coordinates. The response echoes `climateType`. " +
        "For a strict view pass padDays:0 (default). For 'almost in window' pass padDays:7 or 14. " +
        "No API key required; works offline.",
      inputSchema: {
        zone: zoneField.optional(),
        lat: latField.optional(),
        lng: lngField.optional(),
        zip: zipField.optional(),
        date: dateField.optional(),
        category: categoryField.optional(),
        limit: limitField.optional(),
        pad_days: padDaysField.optional(),
        include_indoor: includeIndoorField.optional(),
        climate_type: climateTypeField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const zoneRes = await resolveZoneFromArgs(args);
      if (!zoneRes.ok) return failure(zoneRes.error);
      const climateType = resolveClimateType(args);
      const planRes = getPlantingPlan({
        zone: zoneRes.data,
        ...(args.date ? { date: args.date } : {}),
        ...(args.category ? { category: args.category as CropCategory } : {}),
        ...(args.limit !== undefined ? { limit: args.limit } : {}),
        ...(args.pad_days !== undefined ? { padDays: args.pad_days } : {}),
        ...(args.include_indoor === true ? { includeIndoor: true } : {}),
        ...(climateType ? { climateType } : {}),
      });
      if (!planRes.ok) return failure(planRes.error);
      const briefing: GardenBriefing = {
        zone: planRes.data.zone,
        frostDates: planRes.data.frostDates,
        plantNow: planRes.data.plantNow,
        asOf: planRes.data.asOf,
      };
      if (planRes.data.climateType) {
        briefing.climateType = planRes.data.climateType;
      }
      return success(briefing);
    },
  );
}

function resolveClimateType(args: {
  climate_type?: ClimateType;
  lat?: number;
  lng?: number;
}): ClimateType | undefined {
  if (args.climate_type) return args.climate_type;
  if (args.lat !== undefined && args.lng !== undefined) {
    const coords: Coordinates = { lat: args.lat, lng: args.lng };
    const r = getClimateType(coords);
    return r.ok ? r.data.climateType : undefined;
  }
  return undefined;
}

// ---------------------------------------------------------------------------
// 3. get_crop_details
// ---------------------------------------------------------------------------

function registerGetCropDetails(server: McpServer): void {
  server.registerTool(
    "get_crop_details",
    {
      title: "Detailed Crop Profile from the CropGraph Calendar",
      description:
        "Returns the full crop calendar entry: planting windows, days to harvest, zone range, sowing/transplant guidance, climate modifiers, and citation. " +
        "Look up by slug, common name, or scientific name. Match is case-insensitive. " +
        "Returns an error when the calendar has no entry for the query.",
      inputSchema: {
        slug_or_name: slugOrNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ slug_or_name }) => {
      const entry = findCrop(slug_or_name);
      if (!entry) {
        return failure({
          source: SOURCE,
          message: `No calendar entry for "${slug_or_name}"`,
        });
      }
      return success(entry);
    },
  );
}

// ---------------------------------------------------------------------------
// 4. search_plants
// ---------------------------------------------------------------------------

function registerSearchPlants(server: McpServer): void {
  server.registerTool(
    "search_plants",
    {
      title: "Search the CropGraph Crop Calendar",
      description:
        "Searches the bundled 1000-crop calendar by common name, scientific name, or substring. " +
        "For a focused 'find me the canonical entry for X' use `get_crop_details` instead. " +
        "Filter by zone or category to narrow matches.",
      inputSchema: {
        query: queryField,
        zone: zoneField.optional(),
        category: categoryField.optional(),
        limit: limitField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const limit = args.limit ?? 20;
      let matches: CropEntry[] = searchCrops(args.query, limit);
      if (args.category) {
        matches = matches.filter((c) => c.category === args.category);
      }
      if (args.zone) {
        const zoneNum = parseInt(args.zone.replace(/[^0-9]/g, ""), 10);
        matches = matches.filter(
          (c) => zoneNum >= c.zoneRange.min && zoneNum <= c.zoneRange.max,
        );
      }
      return success({ query: args.query, matches });
    },
  );
}

// ---------------------------------------------------------------------------
// 5. get_crops_for_zone
// ---------------------------------------------------------------------------

function registerGetCropsForZone(server: McpServer): void {
  server.registerTool(
    "get_crops_for_zone",
    {
      title: "Crops Suited to a USDA Zone",
      description:
        "Returns all crop calendar entries whose zone range includes the supplied USDA zone, optionally filtered by category. " +
        "Pure metadata, does NOT consider the current date. For 'what to plant now' use `get_planting_plan` instead. " +
        "Useful for browsing what's possible in a zone, planning beds, or generating seed lists.",
      inputSchema: {
        zone: zoneField,
        category: categoryField.optional(),
      },
      annotations: READ_ONLY,
    },
    async ({ zone, category }) => {
      const r = getCropsForZone(zone, category as CropCategory | undefined);
      return r.ok ? success(r.data) : failure(r.error);
    },
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

interface ZoneArgs {
  zone?: string;
  lat?: number;
  lng?: number;
  zip?: string;
}

async function resolveZoneFromArgs(
  args: ZoneArgs,
): Promise<
  | { ok: true; data: ZoneInfo }
  | { ok: false; error: { source: string; message: string } }
> {
  if (args.zone) {
    const m = /^(\d{1,2})([ab])$/i.exec(args.zone.trim().toLowerCase());
    if (!m || !m[1] || !m[2]) {
      return err({
        source: SOURCE,
        message: `zone must look like "5a" or "8b", got "${args.zone}"`,
      });
    }
    const num = Number(m[1]);
    const sub = m[2].toLowerCase() as "a" | "b";
    const minTempF = -60 + 10 * (num - 1) + (sub === "b" ? 5 : 0);
    return {
      ok: true,
      data: {
        zone: `${num}${sub}`,
        zoneNumber: num,
        subzone: sub,
        minTempF,
        maxTempF: minTempF + 5,
        source: "prism-2023",
        resolvedFrom: "zip-exact",
        zip: "00000",
      },
    };
  }
  if (args.zip) return getHardinessZoneByZip(args.zip);
  if (args.lat !== undefined && args.lng !== undefined) {
    return getHardinessZone({ lat: args.lat, lng: args.lng });
  }
  return err({
    source: SOURCE,
    message: "provide one of {zone}, {zip}, or {lat, lng}",
  });
}

// ---------------------------------------------------------------------------
// 6. get_companions
// ---------------------------------------------------------------------------

function registerGetCompanions(server: McpServer): void {
  server.registerTool(
    "get_companions",
    {
      title: "Companion + Antagonist Plants for a Crop",
      description:
        "Returns companion (beneficial) and antagonist (harmful) plants for a crop, drawn from the bundled 121-edge companion fixture (USDA Extension / Xerces Society / SARE sources). " +
        "Each relationship has a categorized mechanism (12 types: `nitrogen_fixing`, `pest_repellent`, `allelopathic`, `disease_vector`, `pollinator_attractor`, `trap_crop`, `shade_provider`, `ground_cover`, `structural_support`, `nutrient_competition`, `space_efficiency`, `flavor_enhancement`), a gardener-facing description, an evidence-strength grade (`strong` = empirical research, `moderate` = widely corroborated traditional, `weak` = folk only), and a citation. " +
        "Strength grades are honest: most companion-planting lore is `moderate`; only Three Sisters N-cycling, French marigold nematode suppression, allium/Rhizobium inhibition of legumes, nightshade disease sharing, and a handful of pollinator-attractor relationships are `strong`. " +
        "Accepts slug or common name. No API key required; works offline.",
      inputSchema: {
        crop: cropNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ crop }) => {
      const hit = findCrop(crop);
      if (!hit) {
        return failure({
          source: SOURCE,
          message: `no crop calendar match for "${crop}"`,
        });
      }
      const data = getCompanions(hit.slug);
      return success({
        slug: hit.slug,
        commonName: hit.commonName,
        scientificName: hit.scientificName,
        companions: data.companions,
        antagonists: data.antagonists,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 7. check_companion_pair
// ---------------------------------------------------------------------------

function registerCheckCompanionPair(server: McpServer): void {
  server.registerTool(
    "check_companion_pair",
    {
      title: "Check Whether Two Crops Have a Known Relationship",
      description:
        "Looks up whether two specific crops have a known beneficial or antagonist relationship. Returns the relationship detail (mechanism, description, strength, source) or a `found: false` result when no relationship is in the fixture. " +
        "Relationships are directed because mechanisms are often asymmetric (corn provides structural support to bean; bean fixes nitrogen for corn: two distinct edges). The tool falls back to the reverse direction transparently, so order of arguments rarely matters. " +
        "Accepts slugs or common names for both crops.",
      inputSchema: {
        crop_a: cropNameField,
        crop_b: cropNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ crop_a, crop_b }) => {
      const a = findCrop(crop_a);
      if (!a) {
        return failure({
          source: SOURCE,
          message: `no crop calendar match for crop_a "${crop_a}"`,
        });
      }
      const b = findCrop(crop_b);
      if (!b) {
        return failure({
          source: SOURCE,
          message: `no crop calendar match for crop_b "${crop_b}"`,
        });
      }
      const entry = getRelationship(a.slug, b.slug);
      if (!entry) {
        return success({
          found: false,
          crop_a: a.slug,
          crop_b: b.slug,
          commonName_a: a.commonName,
          commonName_b: b.commonName,
        });
      }
      return success({ found: true, ...entry });
    },
  );
}

// ---------------------------------------------------------------------------
// 8. plan_bed_compatibility
// ---------------------------------------------------------------------------

function registerPlanBedCompatibility(server: McpServer): void {
  server.registerTool(
    "plan_bed_compatibility",
    {
      title: "Evaluate a Bed of Crops for Companion Compatibility",
      description:
        "Evaluates a group of 2-20 crops planted in the same bed. Discovers all pairwise relationships (beneficial and antagonist) among the crops in the input, deduplicates by canonical pair order, and surfaces warnings when one crop antagonizes 2+ others (the hub-antagonist pattern; fennel-herb is the canonical example). " +
        "Returns `{ crops, beneficial[], antagonist[], warnings[] }`. Each pair is reported once; if both storage directions exist, the strongest edge is chosen. " +
        "Accepts slugs or common names. Crops with no known relationship to any other crop in the bed are silently absent from the relationship lists.",
      inputSchema: {
        crops: cropListField,
      },
      annotations: READ_ONLY,
    },
    async ({ crops }) => {
      const slugs: string[] = [];
      const resolved: { input: string; slug: string; commonName: string }[] = [];
      for (const c of crops) {
        const hit = findCrop(c);
        if (!hit) {
          return failure({
            source: SOURCE,
            message: `no crop calendar match for "${c}"`,
          });
        }
        slugs.push(hit.slug);
        resolved.push({
          input: c,
          slug: hit.slug,
          commonName: hit.commonName,
        });
      }
      const report = checkBedCompatibility(slugs);
      return success({
        resolved,
        ...report,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 9. get_rotation_advice
// ---------------------------------------------------------------------------

function registerGetRotationAdvice(server: McpServer): void {
  server.registerTool(
    "get_rotation_advice",
    {
      title: "Rotation Family + Year-Gap Rule for a Crop",
      description:
        "Returns the botanical rotation family and rotation rules for a crop, drawn from the bundled 12-family partition of all 1000 calendar crops (USDA Cooperative Extension, SARE, Rodale sources). " +
        "Each crop is in exactly one family (nightshades, brassicas, cucurbits, alliums, legumes, umbellifers, grasses, amaranthaceae, composites, mints, malvaceae, or miscellaneous). " +
        "Per family: `rotationYears` (recommended minimum years between successive plantings of the family in the same bed), `followWith` (families that work well after this one), `neverFollow` (families to avoid following), and `reason` (the dominant pathogens or pests behind the rule). " +
        "Returns `partners.follow` (crops in recommended follow-with families) and `partners.avoid` (crops in never-follow families). " +
        "The miscellaneous bucket covers perennial fruit, nuts, asparagus, rhubarb, mushrooms, aquatic crops, and ornamental flowers; their rotation needs are crop-specific. " +
        "Accepts slug or common name. No API key required; works offline.",
      inputSchema: {
        crop: cropNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ crop }) => {
      const hit = findCrop(crop);
      if (!hit) {
        return failure({
          source: SOURCE,
          message: `no crop calendar match for "${crop}"`,
        });
      }
      const advice = getRotationAdvice(hit.slug);
      if (!advice) {
        return failure({
          source: SOURCE,
          message: `no rotation family for "${hit.slug}"`,
        });
      }
      const partners = getRotationPartners(hit.slug);
      return success({
        commonName: hit.commonName,
        scientificName: hit.scientificName,
        ...advice,
        partners,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 10. check_rotation_sequence
// ---------------------------------------------------------------------------

function registerCheckRotationSequence(server: McpServer): void {
  server.registerTool(
    "check_rotation_sequence",
    {
      title: "Validate a Multi-Year Crop Rotation Plan",
      description:
        "Validates a multi-year sequence of crops planted in the same bed. `crops[0]` is year 1, `crops[1]` is year 2, and so on. " +
        "Reports each violation (a crop family replants inside its required year-gap, e.g. tomato in year 1 then pepper in year 2 violates the 3-year nightshade gap) and each warning (a family lands directly after one it should never follow, e.g. cucurbit after malvaceae). " +
        "Returns `{ sequence: [{slug, family}], issues: [...], ok: boolean }`. Use the `severity` field to triage: `violation` is a hard rule break, `warning` is a soft caution. " +
        "Accepts slugs or common names. Useful for AI agents validating a 3-5 year garden plan or asking 'what should I plant after my tomatoes?'.",
      inputSchema: {
        crops: cropListField,
      },
      annotations: READ_ONLY,
    },
    async ({ crops }) => {
      const slugs: string[] = [];
      const resolved: { input: string; slug: string; commonName: string }[] = [];
      for (const c of crops) {
        const hit = findCrop(c);
        if (!hit) {
          return failure({
            source: SOURCE,
            message: `no crop calendar match for "${c}"`,
          });
        }
        slugs.push(hit.slug);
        resolved.push({
          input: c,
          slug: hit.slug,
          commonName: hit.commonName,
        });
      }
      const report = checkRotationSequence(slugs);
      return success({
        resolved,
        ...report,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 11. get_succession_chain
// ---------------------------------------------------------------------------

function registerGetSuccessionChain(server: McpServer): void {
  server.registerTool(
    "get_succession_chain",
    {
      title: "Succession Planting Chain for a Crop",
      description:
        "Returns the time-sequenced succession chain for a crop, drawn from the bundled 33-chain fixture (Johnny's Selected Seeds, Cornell Extension, UC ANR, SARE, Eliot Coleman's New Organic Grower). " +
        "Each chain has an ordered list of phases. Each phase carries: `crop` (calendar slug), `sowMethod` (`direct_sow` / `transplant` / `start_indoors`), `intervalWeeks` (null means a single sowing, otherwise a recurring cadence), `startRelativeToFrost` and `endRelativeToFrost` (days from last spring frost; negative = before LSF, positive = after), optional per-climate `climateNotes`, and gardener-facing `notes`. " +
        "Categories: `continuous-harvest` (lettuce, spinach, arugula cycles), `root-succession` (radish, carrot, beet, turnip cadences), `legume-succession` (bean / pea relays), `brassica-succession` (broccoli, cabbage spring + fall), `cucurbit-relay` (replacement plantings against vine borer / mildew), `herb-succession` (basil, cilantro, dill cadences), `flower-succession` (zinnia, cosmos, sunflower for continuous cut flowers), `cover-crop-relay` (winter cover → cash crop → fall cover chains). " +
        "Lookup is by chain slug (e.g. `lettuce-succession`), primary crop slug (e.g. `lettuce-leaf`), or any crop slug that appears as a phase. Pair this tool with `get_succession_plan` to resolve the phases to concrete ISO dates for a zone.",
      inputSchema: {
        crop: cropNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ crop }) => {
      const hit = findCrop(crop);
      const chain =
        getSuccessionChain(crop) ??
        (hit ? getSuccessionChain(hit.slug) : undefined);
      if (!chain) {
        return failure({
          source: SOURCE,
          message: `no succession chain for "${crop}"`,
        });
      }
      return success({
        ...(hit
          ? { commonName: hit.commonName, scientificName: hit.scientificName }
          : {}),
        ...chain,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 12. get_succession_plan
// ---------------------------------------------------------------------------

function registerGetSuccessionPlan(server: McpServer): void {
  server.registerTool(
    "get_succession_plan",
    {
      title: "Dated Succession Planting Plan for a Location",
      description:
        "Resolves a succession chain into concrete ISO dates for a location. Provide a USDA zone string ('5b', '8b') OR a coordinate pair / zip; coordinates resolve to a zone via the same lookup as `get_hardiness_zone`. " +
        "Each returned phase carries `windowStart` and `windowEnd` (ISO dates), and `sowingDates` (the dated sowing events within the window when the chain specifies an `intervalWeeks` cadence). " +
        "Climate-aware: pass `climate_type` to apply per-climate notes. When you supply lat/lng or zip without `climate_type`, the tool auto-detects climate from coordinates. The response echoes `climateType` and includes the resolved `zone` and `frostDates`. " +
        "Use `year` to anchor the plan to a specific calendar year (defaults to the current UTC year). " +
        "No API key required; works offline.",
      inputSchema: {
        crop: cropNameField,
        zone: zoneField.optional(),
        lat: latField.optional(),
        lng: lngField.optional(),
        zip: zipField.optional(),
        climate_type: climateTypeField.optional(),
        year: yearField.optional(),
      },
      annotations: READ_ONLY,
    },
    async (args) => {
      const hit = findCrop(args.crop);
      const chain =
        getSuccessionChain(args.crop) ??
        (hit ? getSuccessionChain(hit.slug) : undefined);
      if (!chain) {
        return failure({
          source: SOURCE,
          message: `no succession chain for "${args.crop}"`,
        });
      }
      const zoneRes = await resolveZoneFromArgs(args);
      if (!zoneRes.ok) return failure(zoneRes.error);
      const climateType = resolveClimateType(args);
      const planRes = getSuccessionPlan({
        slug: chain.slug,
        zone: zoneRes.data,
        ...(climateType ? { climateType } : {}),
        ...(args.year !== undefined ? { year: args.year } : {}),
      });
      if (!planRes.ok) return failure(planRes.error);
      return success(planRes.data);
    },
  );
}

// ---------------------------------------------------------------------------
// 13. get_crop_pests
// ---------------------------------------------------------------------------

function registerGetCropPests(server: McpServer): void {
  server.registerTool(
    "get_crop_pests",
    {
      title: "Pests and Diseases Affecting a Crop",
      description:
        "Returns the pests and diseases recorded for a crop, drawn from the bundled 158-entry organic-first pest fixture (Cornell, UC IPM, UF/IFAS, Penn State, OSU, WSU, Texas A&M sources). Each entry carries: `pest` (kebab-case slug, separate namespace from crop slugs), `type` (`pest` for insects/mites/mollusks/nematodes/vertebrates, `disease` for fungi/oomycetes/bacteria/viruses/disorders), `severity` (`low` / `moderate` / `high` / `severe`), `symptoms` (diagnostic prose written for a gardener with a hand lens), `organicManagement` (ordered list of OMRI-listed materials, biocontrols, and physical/cultural practices), `prevention` (cultural and pre-planting practices), `regions` (`all` or informal labels like `southern-us`, `pnw`, `arid`), and a citation. " +
        "Sorted by severity desc, then alphabetically. The fixture is curated, not exhaustive; absence of an entry is not absence of pressure. Pair with `get_companions` to find pest-repellent companion plants for the same crop. " +
        "Accepts slug or common name. No API key required; works offline.",
      inputSchema: {
        crop: cropNameField,
      },
      annotations: READ_ONLY,
    },
    async ({ crop }) => {
      const hit = findCrop(crop);
      if (!hit) {
        return failure({
          source: SOURCE,
          message: `no crop calendar match for "${crop}"`,
        });
      }
      const entries = getPestsByCrop(hit.slug);
      return success({
        slug: hit.slug,
        commonName: hit.commonName,
        scientificName: hit.scientificName,
        entries,
      });
    },
  );
}

// ---------------------------------------------------------------------------
// 14. get_pest_detail
// ---------------------------------------------------------------------------

function registerGetPestDetail(server: McpServer): void {
  server.registerTool(
    "get_pest_detail",
    {
      title: "Full Management Guide for a Pest or Disease",
      description:
        "Returns the full record for one pest or disease across every crop it touches: aggregated severity grades, the union of regions of significance, and per-crop symptoms and organic management. " +
        "Use this when the question is 'tell me about cabbage worm' (a single pest across crops) rather than 'what hits cabbage' (`get_crop_pests`). " +
        "Returns an error when the pest slug isn't in the fixture. Use `get_crop_pests` first to discover pest slugs for a given crop. " +
        "Common slugs include: tomato-hornworm, late-blight, early-blight, cabbage-worm, cabbage-looper, squash-bug, squash-vine-borer, cucumber-beetle-striped, cucumber-beetle-spotted, flea-beetle, japanese-beetle, colorado-potato-beetle, spider-mite, aphid-green-peach, powdery-mildew, downy-mildew, fusarium-wilt, verticillium-wilt, septoria-leaf-spot, bacterial-wilt, mexican-bean-beetle, slug, cutworm, corn-earworm, spotted-wing-drosophila.",
      inputSchema: {
        pest: pestSlugField,
        crops_affected: z
          .boolean()
          .optional()
          .describe(
            "If true, include `cropsAffected` (deduplicated crop slug list) on the response. Default true; helpers infer it from the affects array regardless, but setting false omits the convenience array.",
          ),
      },
      annotations: READ_ONLY,
    },
    async ({ pest, crops_affected }) => {
      const detail = getPestDetail(pest);
      if (!detail) {
        return failure({
          source: SOURCE,
          message: `no pest or disease entry for "${pest}"`,
        });
      }
      const includeCrops = crops_affected !== false;
      const cropsAffected = includeCrops ? getCropsAffected(pest) : undefined;
      return success({
        ...detail,
        ...(cropsAffected ? { cropsAffected } : {}),
      });
    },
  );
}
