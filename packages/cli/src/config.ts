import { mkdir, readFile, rename, writeFile } from "node:fs/promises";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { err, ok, type Coordinates, type Result } from "@cropgraph/core";
import { z } from "zod";

const CoordinatesSchema = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
});

const CropgraphConfigSchema = z.object({
  version: z.literal(1),
  defaultLocation: z
    .object({
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      name: z.string().min(1).max(120).optional(),
    })
    .optional(),
});

export type CropgraphConfig = z.infer<typeof CropgraphConfigSchema>;

export const CONFIG_DIR_ENV = "CROPGRAPH_CONFIG_DIR";

function configDir(): string {
  const fromEnv = process.env[CONFIG_DIR_ENV];
  if (fromEnv && fromEnv.trim() !== "") return fromEnv;
  return join(homedir(), ".cropgraph");
}

export function getConfigPath(): string {
  return join(configDir(), "config.json");
}

export async function loadConfig(): Promise<Result<CropgraphConfig | null>> {
  const path = getConfigPath();
  let raw: string;
  try {
    raw = await readFile(path, "utf8");
  } catch (cause) {
    if (isENOENT(cause)) return ok(null);
    return err({
      source: "cli/config",
      message: `failed to read ${path}: ${stringifyCause(cause)}`,
      cause,
    });
  }
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (cause) {
    return err({
      source: "cli/config",
      message: `${path} is not valid JSON: ${stringifyCause(cause)}`,
      cause,
    });
  }
  const parsed = CropgraphConfigSchema.safeParse(json);
  if (!parsed.success) {
    return err({
      source: "cli/config",
      message: `${path} schema invalid: ${parsed.error.message}`,
    });
  }
  return ok(parsed.data);
}

export async function saveConfig(cfg: CropgraphConfig): Promise<Result<void>> {
  const validated = CropgraphConfigSchema.safeParse(cfg);
  if (!validated.success) {
    return err({
      source: "cli/config",
      message: `refusing to save invalid config: ${validated.error.message}`,
    });
  }
  const path = getConfigPath();
  const tmp = `${path}.tmp-${process.pid}-${Date.now()}`;
  try {
    await mkdir(dirname(path), { recursive: true, mode: 0o700 });
    await writeFile(tmp, `${JSON.stringify(validated.data, null, 2)}\n`, {
      encoding: "utf8",
      mode: 0o600,
    });
    await rename(tmp, path);
    return ok(undefined);
  } catch (cause) {
    return err({
      source: "cli/config",
      message: `failed to write ${path}: ${stringifyCause(cause)}`,
      cause,
    });
  }
}

export function setSavedLocation(
  cfg: CropgraphConfig | null,
  coords: Coordinates,
  name: string | undefined,
): CropgraphConfig {
  const validated = CoordinatesSchema.parse(coords);
  return {
    version: 1,
    defaultLocation: {
      lat: validated.lat,
      lng: validated.lng,
      ...(name ? { name } : {}),
    },
  };
}

function isENOENT(e: unknown): boolean {
  return typeof e === "object" && e !== null && (e as { code?: string }).code === "ENOENT";
}

function stringifyCause(e: unknown): string {
  return e instanceof Error ? e.message : String(e);
}
