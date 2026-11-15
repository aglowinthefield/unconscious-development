// The tracker adapter. Scripts use these verbs and nothing else from the tracker.

export const STATES = ["needs-spec", "ready-for-agent", "ready-for-human", "verifying"] as const;
export type State = (typeof STATES)[number];

export interface Issue {
  number: number;
  url: string;
  title: string;
  body: string;
  labels: string[];
  open: boolean;
}

export interface Tracker {
  getIssue(ref: string | number): Issue;
  setState(issue: Issue, state: State): void;
  addLabel(issue: Issue, label: string): void;
  comment(issue: Issue, body: string): void;
  createIssue(input: { title: string; body: string; labels: string[] }): Issue;
}

export const stateOf = (issue: Issue): State | null =>
  (STATES.find(s => issue.labels.includes(s)) as State | undefined) ?? null;
