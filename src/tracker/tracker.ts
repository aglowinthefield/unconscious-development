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

// A proposed change under review: a pull request on GitHub, a merge request elsewhere.
export interface ChangeRequest {
  number: number;
  head: string; // commit id the review is on
  branch: string;
  files: string[]; // paths the change touches
}

// Someone who wrote a note. `member` means they have a stake in the repo (owner, member,
// collaborator, or the tracker's equivalent).
export interface Person {
  login: string;
  bot: boolean;
  member: boolean;
}

// A review comment. `replyTo` is the id of the note that opens its thread.
export interface Note {
  id: number;
  body: string;
  author: Person;
  replyTo?: number;
}

export interface Tracker {
  getIssue(ref: string | number): Issue;
  setState(issue: Issue, state: State): void;
  addLabel(issue: Issue, label: string): void;
  comment(issue: Issue, body: string): void;
  createIssue(input: { title: string; body: string; labels: string[] }): Issue;

  getChangeRequest(ref: string | number): ChangeRequest;
  openChangeRequests(): ChangeRequest[];
  fileAt(path: string, ref: string): string | null; // null when the file doesn't exist at ref
  // Replace one file on the change request's branch as a new commit. Returns the commit id.
  commitFile(cr: ChangeRequest, file: { path: string; content: string; message: string }): string;
  notes(cr: ChangeRequest): Note[];
  getNote(cr: ChangeRequest, id: number): Note;
  // A note on one line of a file. When the tracker can't attach it there, it attaches it to the
  // file; either way it opens a thread.
  postNote(cr: ChangeRequest, note: { path: string; line: number; body: string }): void;
  reply(cr: ChangeRequest, threadId: number, body: string): void;
}

export const stateOf = (issue: Issue): State | null =>
  (STATES.find(s => issue.labels.includes(s)) as State | undefined) ?? null;
