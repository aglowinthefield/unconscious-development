import { execFileSync } from "node:child_process";
import type { Runner } from "./runner.ts";

// The board's task cards that aren't done yet, one `- key: status` line each, for `unconscious next`.
export function aliceTaskLines(opts: { cwd: string; board?: string; cli: string }): string[] {
  try {
    const out = execFileSync(opts.cli, ["cards", "--json", ...(opts.board ? ["--board", opts.board] : [])], {
      cwd: opts.cwd,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "ignore"],
      timeout: 20_000,
    });
    return JSON.parse(out)
      .filter((c: any) => /^gh-\d+\/t\d+$/.test(c.idempotencyKey ?? "") && !["done", "archived"].includes(c.status))
      .map((c: any) => `- ${c.idempotencyKey}: ${c.status} (Alice card ${String(c.id).slice(0, 8)})`);
  } catch {
    return ["- Alice didn't answer, so its cards aren't shown."];
  }
}

// Alice: a card is a vessel. `create --key` is idempotent per board.
// `cli` is `alice`, or `bakery-cli` where only the pre-rename CLI is installed.
export function aliceRunner(opts: { cwd: string; board?: string; cli: string }): Runner {
  const cli = opts.cli;
  return {
    name: "alice",
    createTask(task, idsByKey) {
      const after = task.after.map((k) => {
        const id = idsByKey.get(k);
        if (!id) throw new Error(`${task.key} waits on ${k}, which has no card yet`);
        return id;
      });
      const args = [
        "create",
        "--title",
        task.title,
        "--body",
        task.body,
        "--key",
        task.key,
        "--json",
        ...after.flatMap((id) => ["--after", id]),
        ...(opts.board ? ["--board", opts.board] : []),
      ];
      const out = execFileSync(cli, args, { cwd: opts.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const card = JSON.parse(out);
      return String(card.id ?? card.card?.id);
    },
  };
}
