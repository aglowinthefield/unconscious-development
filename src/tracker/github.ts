import { execFileSync } from "node:child_process";
import { STATES, type Change, type ChangeRequest, type Issue, type Note, type State, type Tracker } from "./tracker.ts";

const gh = (args: string[], cwd?: string, input?: string, env?: NodeJS.ProcessEnv) =>
  execFileSync("gh", args, { cwd, input, env, encoding: "utf8", stdio: [input === undefined ? "ignore" : "pipe", "pipe", "pipe"] }).trim();

const enc = (path: string) => path.split("/").map(encodeURIComponent).join("/");
const CR_FIELDS = "number,headRefOid,headRefName,files";
const CHANGE_FIELDS = "number,url,title,body,state";
const toChange = (j: any): Change => ({ number: j.number, url: j.url, title: j.title ?? "", body: j.body ?? "", merged: j.state === "MERGED" });
const toCR = (j: any): ChangeRequest =>
  ({ number: j.number, head: j.headRefOid, branch: j.headRefName, files: (j.files ?? []).map((f: any) => f.path) });

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
    close(issue) {
      gh(["issue", "close", String(issue.number), "-R", repo]);
      issue.open = false;
    },
    getChange(ref) {
      const n = String(ref).replace(/^.*\/pull\//, "").replace(/^#/, "");
      return toChange(JSON.parse(gh(["pr", "view", n, "-R", repo, "--json", CHANGE_FIELDS])));
    },
    mergedChangesFor(issue) {
      return JSON.parse(gh(["pr", "list", "-R", repo, "--state", "merged", "--search", String(issue.number), "--limit", "100", "--json", CHANGE_FIELDS]))
        .map(toChange);
    },
    mergedChangesIn(base, head) {
      const shas = !base || /^0+$/.test(base)
        ? [head]
        : gh(["api", `repos/${repo}/compare/${base}...${head}`, "--jq", ".commits[].sha"]).split("\n").filter(Boolean);
      const seen = new Set<number>();
      const changes: Change[] = [];
      for (const sha of shas) {
        const numbers = gh(["api", `repos/${repo}/commits/${sha}/pulls`, "--jq", ".[] | select(.merged_at != null) | .number"])
          .split("\n").filter(Boolean).map(Number);
        for (const n of numbers) {
          if (seen.has(n)) continue;
          seen.add(n);
          changes.push(this.getChange(n));
        }
      }
      return changes;
    },
    openChange({ branch, base, title, body }) {
      const token = process.env.UD_PR_TOKEN;
      const env = token ? { ...process.env, GH_TOKEN: token } : undefined;
      return gh(["pr", "create", "-R", repo, "--head", branch, "--base", base, "--title", title, "--body", body], undefined, undefined, env);
    },
    getChangeRequest(ref) {
      const n = String(ref).replace(/^.*\/pull\//, "").replace(/^#/, "");
      return toCR(JSON.parse(gh(["pr", "view", n, "-R", repo, "--json", CR_FIELDS])));
    },
    openChangeRequests() {
      return JSON.parse(gh(["pr", "list", "-R", repo, "--state", "open", "--limit", "100", "--json", CR_FIELDS])).map(toCR);
    },
    commitFile(cr, { path, content, message }) {
      const sha = gh(["api", `repos/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(cr.branch)}`, "--jq", ".sha"]);
      const input = JSON.stringify({ message, branch: cr.branch, sha, content: Buffer.from(content).toString("base64") });
      return gh(["api", "-X", "PUT", `repos/${repo}/contents/${enc(path)}`, "--input", "-", "--jq", ".commit.sha"], undefined, input);
    },
    fileAt(path, ref) {
      try {
        const b64 = gh(["api", `repos/${repo}/contents/${enc(path)}?ref=${encodeURIComponent(ref)}`, "--jq", ".content"]);
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
    changeComments(cr) {
      const out = gh(["api", "--paginate", `repos/${repo}/issues/${cr.number}/comments`, "--jq", ".[] | @json"]);
      return out ? out.split("\n").map(l => toNote(JSON.parse(l))) : [];
    },
    commentOnChange(cr, body) {
      gh(["api", "-X", "POST", `repos/${repo}/issues/${cr.number}/comments`, "-f", `body=${body}`]);
    },
    editComment(_cr, id, body) {
      gh(["api", "-X", "PATCH", `repos/${repo}/issues/comments/${id}`, "-f", `body=${body}`]);
    },
    fileUrl(path, ref, line) {
      return `https://github.com/${repo}/blob/${ref}/${enc(path)}${line ? `#L${line}` : ""}`;
    },
    resolve(cr, threadId) {
      // Review threads are only addressable in GraphQL, by the database id of their first comment.
      const [owner, name] = repo.split("/");
      const query = `query($owner: String!, $name: String!, $number: Int!, $endCursor: String) {
        repository(owner: $owner, name: $name) { pullRequest(number: $number) {
          reviewThreads(first: 100, after: $endCursor) {
            nodes { id isResolved comments(first: 1) { nodes { databaseId } } }
            pageInfo { hasNextPage endCursor }
          } } } }`;
      const out = gh(["api", "graphql", "--paginate", "-f", `query=${query}`, "-f", `owner=${owner}`, "-f", `name=${name}`,
        "-F", `number=${cr.number}`, "--jq", ".data.repository.pullRequest.reviewThreads.nodes[] | @json"]);
      const thread = (out ? out.split("\n").map(l => JSON.parse(l)) : [])
        .find((t: any) => t.comments.nodes[0]?.databaseId === threadId);
      if (!thread || thread.isResolved) return;
      gh(["api", "graphql", "-f", "query=mutation($id: ID!) { resolveReviewThread(input: { threadId: $id }) { thread { id } } }", "-f", `id=${thread.id}`]);
    },
  };
}
