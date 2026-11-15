import { execFileSync } from "node:child_process";
import type { Runner } from "./runner.ts";

// Bakery: a card is a vessel. `create --key` is idempotent per board.
export function bakeryRunner(opts: { cwd: string; board?: string; cli?: string }): Runner {
  const cli = opts.cli ?? process.env.BAKERY_CLI ?? "bakery-cli";
  return {
    name: "bakery",
    createTask(task, idsByKey) {
      const after = task.after.map(k => {
        const id = idsByKey.get(k);
        if (!id) throw new Error(`${task.key} waits on ${k}, which has no card yet`);
        return id;
      });
      const args = ["create", "--title", task.title, "--body", task.body, "--key", task.key, "--json",
        ...after.flatMap(id => ["--after", id]), ...(opts.board ? ["--board", opts.board] : [])];
      const out = execFileSync(cli, args, { cwd: opts.cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] });
      const card = JSON.parse(out);
      return String(card.id ?? card.card?.id);
    },
  };
}
