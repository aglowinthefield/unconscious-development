import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, mkdtempSync, readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { init } from "../src/init.ts";

const udRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const opts = { udRoot, udSha: "abc1234def" };

test("init lays out the repo, pins the workflow and drafts the Persona", () => {
  const root = mkdtempSync(join(tmpdir(), "ud-init-"));
  const r = init(root, { ...opts, domain: "billing", owner: "tom" });
  assert.deepEqual(r.created.sort(), [
    ".github/workflows/unconscious-tasks.yml",
    ".github/workflows/unconscious.yml",
    "docs/personas/billing.md",
    "docs/specs/.gitkeep",
  ]);
  assert.match(readFileSync(join(root, ".github/workflows/unconscious-tasks.yml"), "utf8"), /^  UD_REF: abc1234def /m);
  const wf = readFileSync(join(root, ".github/workflows/unconscious.yml"), "utf8");
  assert.match(wf, /^  UD_REF: abc1234def /m);
  assert.doesNotMatch(wf, /Copy to/);
  const persona = readFileSync(join(root, "docs/personas/billing.md"), "utf8");
  assert.match(persona, /^domain: billing\nowner: tom\nstatus: draft\n/m);
  assert.match(r.next[0], /persona skill.*status: confirmed/);
});

test("init never overwrites, and a dry run writes nothing", () => {
  const root = mkdtempSync(join(tmpdir(), "ud-init-"));
  assert.deepEqual(init(root, { ...opts, dryRun: true }).created.sort(), [
    ".github/workflows/unconscious-tasks.yml",
    ".github/workflows/unconscious.yml",
    "docs/specs/.gitkeep",
  ]);
  assert.ok(!existsSync(join(root, "docs")));
  init(root, opts);
  const again = init(root, { ...opts, domain: "billing" });
  assert.deepEqual(again.created, ["docs/personas/billing.md"]);
  assert.deepEqual(again.kept.sort(), [
    ".github/workflows/unconscious-tasks.yml",
    ".github/workflows/unconscious.yml",
    "docs/specs/.gitkeep",
  ]);
  assert.match(init(root, opts).next[0], /--domain NAME/);
});

test("a domain must be a plain slug", () => {
  assert.throws(() => init(mkdtempSync(join(tmpdir(), "ud-init-")), { ...opts, domain: "Billing Stuff" }), /lowercase/);
});
