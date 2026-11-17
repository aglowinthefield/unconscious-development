// Questions on the terminal, answered a line at a time. One readline serves every question so
// typed-ahead lines aren't lost; Ctrl+C or Ctrl+D cancels.

import { createInterface, type Interface } from "node:readline/promises";

export class Cancelled extends Error {}

let rl: Interface | undefined;

export async function ask(question: string): Promise<string> {
  rl ??= createInterface({ input: process.stdin, output: process.stdout });
  try { return await rl.question(question); }
  catch (e: any) { if (e?.code === "ABORT_ERR") throw new Cancelled("cancelled"); throw e; }
}

export function doneAsking() { rl?.close(); rl = undefined; }
