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

// A change request's text, enough to tell which issue and task it was for.
export interface Change {
  number: number;
  url: string;
  title: string;
  body: string;
  merged: boolean;
}

export interface Tracker {
  getIssue(ref: string | number): Issue;
  setState(issue: Issue, state: State): void;
  addLabel(issue: Issue, label: string): void;
  comment(issue: Issue, body: string): void;
  createIssue(input: { title: string; body: string; labels: string[] }): Issue;
  close(issue: Issue): void;

  getChangeRequest(ref: string | number): ChangeRequest;
  openChangeRequests(): ChangeRequest[];
  getChange(ref: string | number): Change;
  // Merged change requests whose title or body mentions the issue. May miss some; callers add the
  // one they know about.
  mergedChangesFor(issue: Issue): Change[];
  // Merged change requests whose merge landed in base..head on the default branch, oldest first.
  // A base of all zeros (a new branch) or "" means just head.
  mergedChangesIn(base: string, head: string): Change[];
  // Push nothing; open a change request from a branch already pushed. Returns its URL. On GitHub,
  // UD_PR_TOKEN, when set, opens it instead of the ambient token: a PR opened with Actions'
  // GITHUB_TOKEN runs no workflows, so its checks never start.
  openChange(input: { branch: string; base: string; title: string; body: string }): string;
  fileAt(path: string, ref: string): string | null; // null when the file doesn't exist at ref
  // Replace one file on the change request's branch as a new commit. Returns the commit id.
  commitFile(cr: ChangeRequest, file: { path: string; content: string; message: string }): string;
  notes(cr: ChangeRequest): Note[];
  getNote(cr: ChangeRequest, id: number): Note;
  // A note on one line of a file. When the tracker can't attach it there, it attaches it to the
  // file; either way it opens a thread.
  postNote(cr: ChangeRequest, note: { path: string; line: number; body: string }): void;
  reply(cr: ChangeRequest, threadId: number, body: string): void;
  // Mark a thread resolved, if it isn't already.
  resolve(cr: ChangeRequest, threadId: number): void;
  // Comments on the change request as a whole, not on a line.
  changeComments(cr: ChangeRequest): Note[];
  commentOnChange(cr: ChangeRequest, body: string): void;
  editComment(cr: ChangeRequest, id: number, body: string): void;
  // A link to one line (or the whole) of a file at a commit.
  fileUrl(path: string, ref: string, line?: number): string;
}

// With more than one state label, the furthest along wins, so adding `ready-for-agent` is the
// whole approval: nobody has to remove `needs-spec` first.
const PRECEDENCE: State[] = ["verifying", "ready-for-agent", "ready-for-human", "needs-spec"];
export const stateOf = (issue: Issue): State | null =>
  PRECEDENCE.find(s => issue.labels.includes(s)) ?? null;
