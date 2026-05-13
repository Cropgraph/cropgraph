import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { ResultError } from "@cropgraph/core";

export function success<T>(data: T): CallToolResult {
  const wrapped: Record<string, unknown> = { ok: true, data: data as unknown };
  return {
    content: [{ type: "text", text: JSON.stringify(wrapped, null, 2) }],
    structuredContent: wrapped,
  };
}

export function failure(error: ResultError): CallToolResult {
  const payload: Record<string, unknown> = {
    ok: false,
    error: {
      source: error.source,
      message: error.message,
      ...(error.statusCode !== undefined ? { statusCode: error.statusCode } : {}),
    },
  };
  return {
    content: [{ type: "text", text: JSON.stringify(payload, null, 2) }],
    structuredContent: payload,
    isError: true,
  };
}
