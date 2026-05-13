export type ResultError = {
  source: string;
  message: string;
  statusCode?: number;
  cause?: unknown;
};

export type Result<T> =
  | { ok: true; data: T }
  | { ok: false; error: ResultError };

export function ok<T>(data: T): Result<T> {
  return { ok: true, data };
}

export function err<T = never>(error: ResultError): Result<T> {
  return { ok: false, error };
}
