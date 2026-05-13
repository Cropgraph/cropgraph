import { z } from "zod";

// ---------------------------------------------------------------------------
// Shared Zod fragments. The .describe() strings are the LLM-facing glossary
// for the CropGraph domain: keep them precise and example-rich.
// ---------------------------------------------------------------------------

export const latField = z
  .number()
  .min(-90)
  .max(90)
  .describe(
    "WGS84 latitude in decimal degrees, between -90 and 90. Example: 48.118 for Port Angeles, WA. Used to look up the USDA hardiness zone via the nearest of 40,283 ZIP centroids in the 2023 PRISM dataset.",
  );

export const lngField = z
  .number()
  .min(-180)
  .max(180)
  .describe(
    "WGS84 longitude in decimal degrees, between -180 and 180. Example: -123.4307 for Port Angeles, WA.",
  );

export const zipField = z
  .string()
  .regex(/^\d{5}$/)
  .describe(
    "5-digit US ZIP code. Example: '10001' for Manhattan. Returns the exact PRISM-recorded zone for that ZIP. Some ZIPs are missing from the dataset, use lat/lng for non-listed ZIPs.",
  );

export const zoneField = z
  .string()
  .regex(/^([1-9]|1[0-3])[ab]$/)
  .describe(
    "USDA Plant Hardiness Zone string '1a' through '13b'. Each numeric step is a 10°F band of average annual minimum winter temperature; the 'a'/'b' subzone splits each band into a 5°F upper and lower half. Example: '8b' = 15-20°F, common for the Pacific Northwest coast and the US South.",
  );

export const dateField = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .describe(
    "ISO date YYYY-MM-DD to plan against. Defaults to today (UTC). Use a future date to preview a planting plan, e.g., '2026-06-15' to see what's plantable in mid-June.",
  );

export const categoryField = z
  .enum([
    "vegetable",
    "herb",
    "fruit",
    "flower",
    "cover-crop",
    "root",
    "legume",
  ])
  .describe(
    "Crop category: 'vegetable' (annual food crops), 'herb' (culinary/medicinal), 'fruit' (perennial fruit-bearing trees and berries), 'flower' (companion or pollinator-attracting flowers), 'cover-crop' (soil-builders like clover, rye, vetch), 'root' (root vegetables, subset of vegetable), 'legume' (peas, beans, soil nitrogen fixers).",
  );

export const limitField = z
  .number()
  .int()
  .min(1)
  .max(500)
  .describe("Max suggestions to return. Default 50.");

export const queryField = z
  .string()
  .min(1)
  .max(120)
  .describe(
    "Search query: common name, scientific name, or substring. Examples: 'tomato', 'Lactuca', 'bean', 'broccoli'.",
  );

export const slugOrNameField = z
  .string()
  .min(1)
  .max(120)
  .describe(
    "Crop calendar slug ('tomato', 'pepper-sweet'), common name ('Tomato'), or scientific name ('Solanum lycopersicum'). Match is case-insensitive.",
  );

export const padDaysField = z
  .number()
  .int()
  .min(0)
  .max(60)
  .describe(
    "Window padding in days. A crop is included if today is within [windowStart - padDays, windowEnd + padDays]. Default 0 (strict). Use 7-14 to see crops 'just outside' the recommended window.",
  );

export const includeIndoorField = z
  .boolean()
  .describe(
    "Include indoor-only crops (microgreens, sprouts) in the plan. Default false because their year-round windows otherwise dominate the earliest-harvest sort. Set true if the user is asking about indoor production specifically.",
  );

export const cropNameField = z
  .string()
  .min(1)
  .max(120)
  .describe(
    "Crop identifier: calendar slug ('tomato', 'pepper-sweet', 'fennel-herb'), common name ('Tomato', 'Sweet Pepper'), scientific name ('Solanum lycopersicum'), or alias. Case-insensitive. The tool resolves any of these to the canonical slug before lookup.",
  );

export const cropListField = z
  .array(cropNameField)
  .min(2)
  .max(20)
  .describe(
    "List of 2-20 crops to evaluate together (slugs or common names). Used by `plan_bed_compatibility` to discover all pairwise relationships within the bed.",
  );

export const climateTypeField = z
  .enum([
    "maritime",
    "mediterranean",
    "continental",
    "humid_subtropical",
    "arid",
    "semi_arid",
  ])
  .describe(
    "Coarse climate type used to apply per-climate modifiers to the planting plan. USDA hardiness zones only measure winter minimum temperature; climate adds the missing summer/humidity/rainfall context. " +
      "Auto-detected from lat/lng when omitted (and when coordinates are supplied). Values: 'maritime' (cool summers, mild winters, consistent moisture, PNW coast), 'mediterranean' (warm dry summers, mild wet winters, coastal CA), 'continental' (hot summers, cold winters, Midwest/Plains), 'humid_subtropical' (hot humid summers, SE US/Gulf), 'arid' (hot dry summers, Desert SW), 'semi_arid' (moderate summers, low rain, High Plains/Intermountain West). " +
      "When applied, matching crops get window date shifts (negative weeks = earlier) and climate-specific notes appended to the suggestion's notes.",
  );
