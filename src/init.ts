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

export const domainProblem = (domain: string) =>
  /^[a-z0-9][a-z0-9-]*$/.test(domain) ? undefined : `domain "${domain}" must be lowercase letters, digits and dashes, like billing or ingestion-search`;

export function init(root: string, opts: InitOptions): InitResult {
  const problem = opts.domain === undefined ? undefined : domainProblem(opts.domain);
  if (problem) throw new Error(problem);
  const workflow = (name: string) => readFileSync(join(opts.udRoot, "workflows", name), "utf8")
    .replace(/^# Copy to .*\n#\n/, "")
    .replace(/^  UD_REF: .*$/m, `  UD_REF: ${opts.udSha} # the Unconscious Development commit this repo runs; bump it to update`);
  const files: Record<string, string> = {
    "docs/specs/.gitkeep": "",
    ".github/workflows/unconscious.yml": workflow("unconscious.yml"),
    ".github/workflows/unconscious-tasks.yml": workflow("unconscious-tasks.yml"),
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
      ? `Have your agent draft ${persona} from the code with the persona skill ("draft the ${opts.domain} persona"), or fill it in by hand. A draft is enough to start: check-spec warns until you set \`status: confirmed\`.`
      : "Name your first domain (the area of the code a spec belongs to) by running init again with --domain NAME.",
    "Commit these files on a branch, open a PR and merge it. If the default branch refuses pushes from GitHub Actions, the task job opens a PR to mark a spec built instead of pushing it.",
    `Then write your first spec: ${join(opts.udRoot, "docs/Quickstart.md")}, from "Your first change".`,
  ];
  return { created, kept, next };
}
