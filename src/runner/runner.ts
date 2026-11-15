// The runner adapter. A task is one vessel: one agent session in one fresh worktree.

export interface TaskInput {
  key: string; // gh-<issue>/<task>, stable so a rerun finds the same task
  title: string;
  body: string;
  after: string[]; // keys of tasks this one waits on
}

export interface Runner {
  name: string;
  // Creates the task, or returns the existing one with the same key. Returns the runner's id.
  createTask(task: TaskInput, idsByKey: Map<string, string>): string;
}
