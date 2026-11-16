import { execFileSync } from "node:child_process";
import { STATES, type ChangeRequest, type Issue, type Note, type State, type Tracker } from "./tracker.ts";

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
  const toNote = (j: any): Note => ({
    id: j.id,
    body: j.body ?? "",
    author: {
      login: j.user.login,
      bot: j.user.type === "Bot",
      member: ["OWNER", "MEMBER", "COLLABORATOR"].includes(j.author_association),
    },
    replyTo: j.in_reply_to_id ?? undefined,
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
    getChangeRequest(ref) {
      const n = String(ref).replace(/^.*\/pull\//, "").replace(/^#/, "");
      const j = JSON.parse(gh(["pr", "view", n, "-R", repo, "--json", "number,headRefOid,headRefName,files"]));
      return { number: j.number, head: j.headRefOid, branch: j.headRefName, files: j.files.map((f: any) => f.path) };
    },
    fileAt(path, ref) {
      try {
        const b64 = gh(["api", `repos/${repo}/contents/${path}?ref=${ref}`, "--jq", ".content"]);
        return Buffer.from(b64, "base64").toString("utf8");
      } catch {
        return null;
      }
    },
    notes(cr) {
      const out = gh(["api", "--paginate", `repos/${repo}/pulls/${cr.number}/comments`, "--jq", ".[] | @json"]);
      return out ? out.split("\n").map(l => toNote(JSON.parse(l))) : [];
    },
    getNote(_cr, id) {
      return toNote(JSON.parse(gh(["api", `repos/${repo}/pulls/comments/${id}`])));
    },
    postNote(cr: ChangeRequest, { path, line, body }) {
      const base = ["api", "-X", "POST", `repos/${repo}/pulls/${cr.number}/comments`, "-f", `body=${body}`, "-f", `commit_id=${cr.head}`, "-f", `path=${path}`];
      try {
        gh([...base, "-F", `line=${line}`, "-f", "side=RIGHT"]);
      } catch {
        gh([...base, "-f", "subject_type=file"]); // the line is outside the diff
      }
    },
    reply(cr, threadId, body) {
      gh(["api", "-X", "POST", `repos/${repo}/pulls/${cr.number}/comments/${threadId}/replies`, "-f", `body=${body}`]);
    },
  };
}
