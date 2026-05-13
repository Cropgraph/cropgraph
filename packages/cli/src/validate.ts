import { err, ok, type Result } from "@cropgraph/core";

function parseFiniteNumber(raw: string): Result<number> {
  if (raw.trim() === "") {
    return err({ source: "cli", message: "expected a number, got empty string" });
  }
  const n = Number(raw);
  if (!Number.isFinite(n)) {
    return err({ source: "cli", message: `not a finite number: ${raw}` });
  }
  return ok(n);
}

export function parseLat(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --lat: ${r.error.message}` });
  if (r.data < -90 || r.data > 90) {
    return err({ source: "cli", message: `--lat out of range (-90..90): ${r.data}` });
  }
  return ok(r.data);
}

export function parseLng(raw: string): Result<number> {
  const r = parseFiniteNumber(raw);
  if (!r.ok) return err({ source: "cli", message: `invalid --lng: ${r.error.message}` });
  if (r.data < -180 || r.data > 180) {
    return err({ source: "cli", message: `--lng out of range (-180..180): ${r.data}` });
  }
  return ok(r.data);
}
