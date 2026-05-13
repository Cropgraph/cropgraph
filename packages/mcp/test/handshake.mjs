// Minimal MCP handshake harness: spawn the built server over stdio, send
// initialize -> tools/list -> tools/call(get_planting_plan), and print the
// results. No vitest, no MCP client SDK, just JSON-RPC line framing.

import { spawn } from "node:child_process";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const here = dirname(fileURLToPath(import.meta.url));
const SERVER = resolve(here, "../dist/index.js");

const child = spawn(process.execPath, [SERVER], {
  stdio: ["pipe", "pipe", "inherit"],
});

let buf = "";
const pending = new Map();

child.stdout.setEncoding("utf8");
child.stdout.on("data", (chunk) => {
  buf += chunk;
  let nl;
  while ((nl = buf.indexOf("\n")) !== -1) {
    const line = buf.slice(0, nl).trim();
    buf = buf.slice(nl + 1);
    if (!line) continue;
    let msg;
    try {
      msg = JSON.parse(line);
    } catch {
      continue;
    }
    if (msg.id !== undefined && pending.has(msg.id)) {
      const resolver = pending.get(msg.id);
      pending.delete(msg.id);
      resolver(msg);
    }
  }
});

function send(method, params, id) {
  const req = { jsonrpc: "2.0", id, method, params };
  child.stdin.write(JSON.stringify(req) + "\n");
  return new Promise((res) => pending.set(id, res));
}

try {
  const init = await send(
    "initialize",
    {
      protocolVersion: "2025-06-18",
      capabilities: {},
      clientInfo: { name: "handshake-harness", version: "0.0.0" },
    },
    1,
  );
  console.log("initialize ok:", init.result?.serverInfo);

  child.stdin.write(
    JSON.stringify({
      jsonrpc: "2.0",
      method: "notifications/initialized",
    }) + "\n",
  );

  const list = await send("tools/list", {}, 2);
  const tools = list.result?.tools ?? [];
  console.log(`tools/list: ${tools.length} tools`);
  for (const t of tools) console.log(`  - ${t.name}`);

  if (tools.length !== 8) {
    console.error(`expected 8 tools, got ${tools.length}`);
    process.exit(1);
  }

  const call = await send(
    "tools/call",
    {
      name: "get_planting_plan",
      arguments: { lat: 48.118, lng: -123.4307 },
    },
    3,
  );
  const payload = call.result?.structuredContent;
  if (!payload?.ok) {
    console.error("get_planting_plan failed:", call.result);
    process.exit(1);
  }
  const briefing = payload.data;
  console.log(
    `get_planting_plan ok: zone ${briefing.zone.zone}, climate ${briefing.climateType ?? "auto"}, ${briefing.plantNow.length} suggestions`,
  );
} finally {
  child.kill();
}
