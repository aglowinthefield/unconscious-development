import { test } from "node:test";
import assert from "node:assert/strict";
import { chmodSync, mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { githubTracker } from "../src/tracker/github.ts";

// A stand-in `gh` for the contents API of one file on one branch. Like GitHub, a PUT must send the
// blob sha of the file at the branch head, or it gets a 409.
const FAKE_GH = `#!/usr/bin/env node
const fs = require("fs"), crypto = require("crypto");
const S = process.env.FAKE_GH_STATE, st = JSON.parse(fs.readFileSync(S, "utf8"));
const args = process.argv.slice(2), url = args.find((a) => a.startsWith("repos/"));
const blob = (c) => crypto.createHash("sha1").update(c).digest("hex");
const at = (ref) => st.commits.find((c) => c.sha === ref) ?? st.commits.at(-1);
if (args.includes("PUT")) {
  const req = JSON.parse(fs.readFileSync(0, "utf8"));
  if (req.sha !== blob(at().content)) { process.stderr.write("gh: sha does not match (HTTP 409)\\n"); process.exit(1); }
  const sha = "c" + st.commits.length;
  st.commits.push({ sha, content: Buffer.from(req.content, "base64").toString("utf8") });
  fs.writeFileSync(S, JSON.stringify(st));
  console.log(sha);
} else {
  const c = at(decodeURIComponent(url.split("?ref=")[1]));
  console.log(args.includes(".sha") ? blob(c.content) : Buffer.from(c.content).toString("base64"));
}
`;

function withFakeGh(commits: { sha: string; content: string }[], fn: (state: string) => void) {
  const dir = mkdtempSync(join(tmpdir(), "ud-gh-"));
  writeFileSync(join(dir, "gh"), FAKE_GH);
  chmodSync(join(dir, "gh"), 0o755);
  const state = join(dir, "state.json");
  writeFileSync(state, JSON.stringify({ commits }));
  const saved = { PATH: process.env.PATH, FAKE_GH_STATE: process.env.FAKE_GH_STATE };
  process.env.PATH = `${dir}:${process.env.PATH}`;
  process.env.FAKE_GH_STATE = state;
  try {
    fn(state);
  } finally {
    Object.assign(process.env, saved);
  }
}

test("commitFile refuses to overwrite a file that changed after the head it was built from", () =>
  withFakeGh(
    [
      { sha: "c0", content: "AC1: [NEEDS CLARIFICATION: p95 ms]\n" },
      { sha: "c1", content: "AC1: [NEEDS CLARIFICATION: p95 ms]\nAC9: added by the Ruler.\n" },
    ],
    (state) => {
      const t = githubTracker("o/r");
      const stale = { number: 1, head: "c0", branch: "spec/1", files: [] };
      assert.throws(
        () => t.commitFile(stale, { path: "docs/specs/x.md", content: "AC1: 500 ms\n", message: "answer" }),
        /409/,
      );
      const fresh = { ...stale, head: "c1" };
      assert.equal(
        t.commitFile(fresh, {
          path: "docs/specs/x.md",
          content: "AC1: 500 ms\nAC9: added by the Ruler.\n",
          message: "answer",
        }),
        "c2",
      );
      assert.match(JSON.parse(readFileSync(state, "utf8")).commits.at(-1).content, /AC9/);
    },
  ));
