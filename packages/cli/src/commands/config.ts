import { Command } from "commander";
import pc from "picocolors";
import {
  getConfigPath,
  loadConfig,
  saveConfig,
  setSavedLocation,
} from "../config.js";
import { fail, printJson } from "../format.js";
import { parseLat, parseLng } from "../validate.js";

interface SetLocationOpts {
  lat: string;
  lng: string;
  name?: string;
}

export function buildConfigCommand(): Command {
  const cmd = new Command("config").description(
    `Manage the saved cropgraph configuration. Stored at ${getConfigPath()}. Currently holds a default location.`,
  );

  cmd
    .command("show")
    .description("Print the current saved configuration as JSON.")
    .action(async () => {
      const r = await loadConfig();
      if (!r.ok) return fail(r.error.message);
      if (!r.data) {
        console.log(pc.dim(`(no config at ${getConfigPath()})`));
        return;
      }
      printJson(r.data);
    });

  cmd
    .command("set-location")
    .description(
      "Save a default location used when --lat / --lng are omitted.",
    )
    .requiredOption("--lat <lat>", "Latitude (-90..90)")
    .requiredOption("--lng <lng>", "Longitude (-180..180)")
    .option("--name <name>", "Friendly label printed alongside the coords")
    .action(async (opts: SetLocationOpts) => {
      const lat = parseLat(opts.lat);
      if (!lat.ok) return fail(lat.error.message);
      const lng = parseLng(opts.lng);
      if (!lng.ok) return fail(lng.error.message);
      const existing = await loadConfig();
      if (!existing.ok) return fail(existing.error.message);
      const next = setSavedLocation(
        existing.data,
        { lat: lat.data, lng: lng.data },
        opts.name,
      );
      const written = await saveConfig(next);
      if (!written.ok) return fail(written.error.message);
      console.log(
        `Saved default location to ${getConfigPath()} (${lat.data}, ${lng.data}${opts.name ? `, ${opts.name}` : ""}).`,
      );
    });

  return cmd;
}
