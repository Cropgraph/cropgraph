import { err, ok, type Coordinates, type Result } from "@cropgraph/core";
import { loadConfig } from "./config.js";
import { parseLat, parseLng } from "./validate.js";

export type LocationSource = "flags" | "config";

export interface ResolvedLocation {
  coords: Coordinates;
  source: LocationSource;
  name?: string;
}

export interface LocationFlags {
  lat?: string;
  lng?: string;
}

export async function resolveLocation(
  flags: LocationFlags,
): Promise<Result<ResolvedLocation>> {
  const hasLat = flags.lat !== undefined;
  const hasLng = flags.lng !== undefined;

  if (hasLat !== hasLng) {
    return err({
      source: "cli",
      message: "must provide both --lat and --lng, or neither",
    });
  }

  if (hasLat && hasLng) {
    const lat = parseLat(flags.lat as string);
    if (!lat.ok) return lat;
    const lng = parseLng(flags.lng as string);
    if (!lng.ok) return lng;
    return ok({ coords: { lat: lat.data, lng: lng.data }, source: "flags" });
  }

  const cfgRes = await loadConfig();
  if (!cfgRes.ok) return cfgRes;
  const saved = cfgRes.data?.defaultLocation;
  if (!saved) {
    return err({
      source: "cli",
      message:
        "no location provided and no saved default. Run `cropgraph config set-location --lat <lat> --lng <lng> [--name <name>]` or pass --lat and --lng.",
    });
  }
  const result: ResolvedLocation = {
    coords: { lat: saved.lat, lng: saved.lng },
    source: "config",
  };
  if (saved.name) result.name = saved.name;
  return ok(result);
}
