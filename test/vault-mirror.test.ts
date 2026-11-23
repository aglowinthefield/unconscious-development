import { test } from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, readlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { syncVault } from "../src/vault-mirror.ts";

const git = (cwd: string, ...args: string[]) =>
  execFileSync("git", ["-c", "user.name=t", "-c", "user.email=t@t", ...args], {
    cwd,
    encoding: "utf8",
    stdio: ["ignore", "pipe", "pipe"],
  }).trim();

// An origin with docs/specs and docs/personas on main, and a clone of it.
function setup() {
  const root = mkdtempSync(join(tmpdir(), "ud-mirror-"));
  const origin = join(root, "origin.git"),
    checkout = join(root, "checkout"),
    vault = join(root, "vault");
  git(root, "init", "-q", "--bare", "-b", "main", origin);
  git(root, "clone", "-q", origin, checkout);
  mkdirSync(join(checkout, "docs/specs/billing"), { recursive: true });
  mkdirSync(join(checkout, "docs/personas"), { recursive: true });
  writeFileSync(join(checkout, "docs/specs/billing/refunds.md"), "v1\n");
  writeFileSync(join(checkout, "docs/personas/billing.md"), "persona\n");
  git(checkout, "add", "docs");
  git(checkout, "commit", "-q", "-m", "specs");
  git(checkout, "push", "-q", "origin", "HEAD:main");
  git(checkout, "fetch", "-q", "origin", "main");
  process.env.UD_MIRROR_DIR = join(root, "mirrors");
  const fm = { repo: "o/r", path: checkout, vault: "Billing" };
  return { root, checkout, vault, fm, mirror: join(root, "mirrors/o/r") };
}

test("links Specs and Personas to a worktree that follows origin/main, not the checkout", () => {
  const { checkout, vault, fm, mirror } = setup();
  assert.deepEqual(syncVault(fm, vault), []);
  assert.equal(readlinkSync(join(vault, "Billing/Specs")), join(mirror, "docs/specs"));
  assert.equal(readlinkSync(join(vault, "Billing/Personas")), join(mirror, "docs/personas"));

  // A merge to main shows up; the checkout's own unpushed edit does not.
  writeFileSync(join(checkout, "docs/specs/billing/refunds.md"), "v2\n");
  git(checkout, "commit", "-qam", "v2");
  git(checkout, "push", "-q", "origin", "HEAD:main");
  writeFileSync(join(checkout, "docs/specs/billing/refunds.md"), "local only\n");
  git(checkout, "fetch", "-q", "origin", "main");
  assert.deepEqual(syncVault(fm, vault), []);
  assert.equal(readFileSync(join(vault, "Billing/Specs/billing/refunds.md"), "utf8"), "v2\n");
});

test("stops following main while the mirror has edits, and says so", () => {
  const { vault, fm, mirror } = setup();
  syncVault(fm, vault);
  writeFileSync(join(vault, "Billing/Specs/billing/refunds.md"), "edited in Obsidian\n");
  const [problem] = syncVault(fm, vault);
  assert.match(problem, /has local edits/);
  assert.equal(readFileSync(join(mirror, "docs/specs/billing/refunds.md"), "utf8"), "edited in Obsidian\n");
});

test("never replaces a real folder, and repoints an old link", () => {
  const { root, vault, fm, mirror } = setup();
  mkdirSync(join(vault, "Billing/Specs"), { recursive: true });
  writeFileSync(join(vault, "Billing/Specs/old.md"), "mine\n");
  execFileSync("ln", ["-s", join(root, "checkout/docs/personas"), join(vault, "Billing/Personas")]);
  const problems = syncVault(fm, vault);
  assert.equal(problems.length, 1);
  assert.match(problems[0], /Specs is a real folder/);
  assert.equal(readFileSync(join(vault, "Billing/Specs/old.md"), "utf8"), "mine\n");
  assert.equal(readlinkSync(join(vault, "Billing/Personas")), join(mirror, "docs/personas"));
});

test("does nothing without vault: in the page", () => {
  const { vault, fm } = setup();
  assert.deepEqual(syncVault({ ...fm, vault: undefined }, vault), []);
});

test("leaves the links to another machine when UD_VAULT_MIRROR=off", () => {
  const { vault, fm, mirror } = setup();
  process.env.UD_VAULT_MIRROR = "off";
  try {
    assert.deepEqual(syncVault(fm, vault), []);
  } finally {
    delete process.env.UD_VAULT_MIRROR;
  }
  assert.throws(() => readlinkSync(join(vault, "Billing/Specs")));
  assert.throws(() => readFileSync(join(mirror, "docs/specs/billing/refunds.md")));
});
