import type { Runner } from "./runner.ts";

// A plain agent session started by hand. Creating a task prints what to paste into it.
export function sessionRunner(write: (s: string) => void = (s) => process.stdout.write(s)): Runner {
  return {
    name: "session",
    createTask(task) {
      const waits = task.after.length ? `\nStart after: ${task.after.join(", ")}\n` : "";
      write(`\n===== ${task.title}${waits}\n${task.body}\n`);
      return task.key;
    },
  };
}
