// Shared display utilities for the cropgraph CLI.

export function printJson(data: unknown): void {
  process.stdout.write(`${JSON.stringify(data, null, 2)}\n`);
}

export function fail(message: string): never {
  process.stderr.write(`cropgraph: ${message}\n`);
  process.exit(1);
}
