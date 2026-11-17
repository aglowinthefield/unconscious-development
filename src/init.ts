// Set a project repo up for Unconscious Development: the folders specs and Personas live in, a
// draft Persona for one domain, and the CI workflow pinned to this checkout's commit. It never
// overwrites a file, so running it again only adds what's missing.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";

export interface InitOptions {
  udRoot: string; // this checkout of Unconscious Development
  udSha: string; // the commit the workflow pins
  domain?: string;
  owner?: string;
  dryRun?: boolean;
}

export interface InitResult { created: string[]; kept: string[]; next: string[] }

export function init(root: string, opts: InitOptions): InitResult {
  if (opts.domain !== undefined && !/^[a-z0-9][a-z0-9-]*$/.test(opts.domain))
    throw new Error(`domain "${opts.domain}" must be lowercase letters, digits and dashes, like billing or ingestion-search`);
  const files: Record<string, string> = {
    "docs/specs/.gitkeep": "",
    ".github/workflows/unconscious.yml": readFileSync(join(opts.udRoot, "workflows/unconscious.yml"), "utf8")
      .replace(/^# Copy to .*\n#\n/, "")
      .replace(/^  UD_REF: .*$/m, `  UD_REF: ${opts.udSha} # the Unconscious Development commit this repo runs; bump it to update`),
  };
  if (opts.domain) {
    files[`docs/personas/${opts.domain}.md`] = readFileSync(join(opts.udRoot, "skills/spec/templates/persona.md"), "utf8")
      .replace("domain: <domain>", `domain: ${opts.domain}`)
      .replace("owner: <person>", `owner: ${opts.owner ?? "<person>"}`);
  }

  const created: string[] = [], kept: string[] = [];
  for (const [path, content] of Object.entries(files)) {
    const full = join(root, path);
    if (existsSync(full)) { kept.push(path); continue; }
    created.push(path);
    if (opts.dryRun) continue;
    mkdirSync(dirname(full), { recursive: true });
    writeFileSync(full, content);
  }

  const persona = opts.domain && `docs/personas/${opts.domain}.md`;
  const next = [
    persona
      ? `Fill in ${persona}: its scope and the invariants this domain refuses to break. Set \`status: confirmed\` when they're right; a plan fails check-spec until its Persona is confirmed.`
      : "Name your first domain (the area of the code a spec belongs to) by running init again with --domain NAME.",
    "Commit these files on a branch, open a PR and merge it.",
    `Then write your first spec: ${join(opts.udRoot, "docs/Quickstart.md")}, from "Your first change".`,
  ];
  return { created, kept, next };
}
