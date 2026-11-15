import { execFileSync } from "node:child_process";
import { STATES, type Issue, type State, type Tracker } from "./tracker.ts";

const gh = (args: string[], cwd?: string) =>
  execFileSync("gh", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();

export function repoFromRemote(cwd: string): string {
  return gh(["repo", "view", "--json", "nameWithOwner", "--jq", ".nameWithOwner"], cwd);
}

export function githubTracker(repo: string): Tracker {
  let labels: Set<string> | null = null;
  const ensureLabel = (name: string) => {
    labels ??= new Set(gh(["label", "list", "-R", repo, "--limit", "500", "--json", "name", "--jq", ".[].name"]).split("\n"));
    if (labels.has(name)) return;
    gh(["label", "create", name, "-R", repo]);
    labels.add(name);
  };
  const toIssue = (j: any): Issue => ({
    number: j.number,
    url: j.url,
    title: j.title,
    body: j.body ?? "",
    labels: (j.labels ?? []).map((l: any) => l.name),
    open: j.state === "OPEN",
  });
  return {
    getIssue(ref) {
      const m = /\/issues\/(\d+)/.exec(String(ref));
      const n = m ? m[1] : String(ref).replace(/^#/, "");
      return toIssue(JSON.parse(gh(["issue", "view", n, "-R", repo, "--json", "number,url,title,body,labels,state"])));
    },
    setState(issue, state: State) {
      ensureLabel(state);
      const remove = STATES.filter(s => s !== state && issue.labels.includes(s));
      gh(["issue", "edit", String(issue.number), "-R", repo, "--add-label", state, ...remove.flatMap(s => ["--remove-label", s])]);
      issue.labels = [...issue.labels.filter(l => !remove.includes(l as State)), state];
    },
    addLabel(issue, label) {
      ensureLabel(label);
      gh(["issue", "edit", String(issue.number), "-R", repo, "--add-label", label]);
      issue.labels.push(label);
    },
    comment(issue, body) {
      gh(["issue", "comment", String(issue.number), "-R", repo, "--body", body]);
    },
    createIssue({ title, body, labels: names }) {
      names.forEach(ensureLabel);
      const url = gh(["issue", "create", "-R", repo, "--title", title, "--body", body, ...names.flatMap(l => ["--label", l])]);
      return this.getIssue(url);
    },
  };
}
