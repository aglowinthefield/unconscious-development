import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { basename, dirname, join, relative } from "node:path";
import { listItems, markers, parseDoc, section, tableRows, type Doc } from "./markdown.ts";

export const SPEC_SECTIONS = ["Goal", "Non-goals", "Acceptance criteria", "Setup note", "Surfaces touched", "Cost and scale"];
export const PLAN_SECTIONS = ["Approach", "Data model and contracts", "Invariants", "Tasks"];
export const SPEC_STATUSES = ["draft", "approved", "built"];

export interface Criterion { id: string; afterDeploy: boolean; text: string }
export interface Task { id: string; done: boolean; text: string; criteria: string[]; after: string[] }
export interface Problem { file: string; line?: number; message: string }

export interface Spec {
  path: string;
  domain: string;
  status: string;
  issues: string[];
  criteria: Criterion[];
  setupNote: string;
  doc: Doc;
}

export interface Plan {
  path: string;
  issue: string;
  budgetUsd: number | null;
  invariants: { id: string; verdict: string }[];
  tasks: Task[];
  doc: Doc;
}

const str = (v: unknown) => (typeof v === "string" ? v : "");
const arr = (v: unknown) => (Array.isArray(v) ? v : typeof v === "string" && v ? [v] : []);

export function parseCriteria(body: string): Criterion[] {
  return listItems(body).flatMap(item => {
    const m = /^(AC\d+)\s*(\(after deploy\))?\s*:\s*(.*)$/i.exec(item);
    return m ? [{ id: m[1].toUpperCase(), afterDeploy: Boolean(m[2]), text: m[3] }] : [];
  });
}

export function parseTasks(body: string): Task[] {
  return listItems(body).flatMap(item => {
    const m = /^\[( |x|X)\]\s+(t\d+)\s*:\s*(.*)$/.exec(item);
    if (!m) return [];
    const rest = m[3];
    const crit = /Criteria:\s*([^.]*)/i.exec(rest);
    const after = /\bafter:\s*([^.]*)/i.exec(rest);
    const text = rest.split(/\s*Criteria:/i)[0].replace(/\.\s*$/, "").trim();
    return [{
      id: m[2],
      done: m[1].toLowerCase() === "x",
      text,
      criteria: crit ? [...crit[1].matchAll(/AC\d+/gi)].map(x => x[0].toUpperCase()) : [],
      after: after ? [...after[1].matchAll(/t\d+/g)].map(x => x[0]) : [],
    }];
  });
}

export function readSpec(path: string, text = readFileSync(path, "utf8")): Spec {
  const doc = parseDoc(text);
  const fm = doc.frontmatter ?? {};
  return {
    path,
    domain: str(fm.domain),
    status: str(fm.status),
    issues: arr(fm.issues),
    criteria: parseCriteria(section(doc, "Acceptance criteria")?.body ?? ""),
    setupNote: (section(doc, "Setup note")?.body ?? "").trim(),
    doc,
  };
}

export function readPlan(path: string, text = readFileSync(path, "utf8")): Plan {
  const doc = parseDoc(text);
  const fm = doc.frontmatter ?? {};
  const budget = Number(str(fm.budget_usd));
  return {
    path,
    issue: str(fm.issue),
    budgetUsd: str(fm.budget_usd) !== "" && Number.isFinite(budget) ? budget : null,
    invariants: listItems(section(doc, "Invariants")?.body ?? "").flatMap(item => {
      const m = /^`?([\w-]+\/I\d+)`?\s*:\s*(.*)$/.exec(item);
      return m ? [{ id: m[1], verdict: m[2].trim() }] : [];
    }),
    tasks: parseTasks(section(doc, "Tasks")?.body ?? ""),
    doc,
  };
}

export interface Persona { path: string; status: string; invariants: string[] }

export function readPersona(root: string, domain: string): Persona | null {
  const path = join(root, "docs/personas", `${domain}.md`);
  if (!existsSync(path)) return null;
  const doc = parseDoc(readFileSync(path, "utf8"));
  const rows = tableRows(section(doc, "Invariants")?.body ?? "");
  return {
    path,
    status: str(doc.frontmatter?.status),
    invariants: rows.map(r => r[0]).filter(id => /^I\d+$/.test(id)).map(id => `${domain}/${id}`),
  };
}

export const planPathFor = (specPath: string) => specPath.replace(/\.md$/, ".plan.md");
export const specPathFor = (planPath: string) => planPath.replace(/\.plan\.md$/, ".md");
export const isPlan = (path: string) => path.endsWith(".plan.md");

function checkSections(file: string, doc: Doc, required: string[], problems: Problem[]) {
  const headings = doc.sections.map(s => s.heading);
  const missing = required.filter(h => !headings.some(x => x.toLowerCase() === h.toLowerCase()));
  for (const h of missing) problems.push({ file, message: `missing section "## ${h}"` });
  if (missing.length) return;
  const order = required.map(h => headings.findIndex(x => x.toLowerCase() === h.toLowerCase()));
  if (order.some((v, i) => i > 0 && v < order[i - 1]))
    problems.push({ file, message: `sections out of order; expected ${required.join(", ")}` });
  for (const h of required) {
    const s = section(doc, h)!;
    if (!s.body.trim()) problems.push({ file, line: s.line, message: `"## ${h}" is empty (write \`none\` if nothing applies)` });
  }
}

function checkMarkers(file: string, text: string, problems: Problem[]) {
  for (const m of markers(text)) problems.push({ file, line: m.line, message: `open question: ${m.text}` });
}

export function checkSpecFile(root: string, path: string): Problem[] {
  const file = relative(root, path);
  const text = readFileSync(path, "utf8");
  const spec = readSpec(path, text);
  const problems: Problem[] = [];
  if (!spec.doc.frontmatter) return [{ file, message: "no frontmatter" }];
  const fm = spec.doc.frontmatter;
  if (!spec.domain) problems.push({ file, message: "frontmatter needs `domain`" });
  else if (basename(dirname(path)) !== spec.domain)
    problems.push({ file, message: `domain "${spec.domain}" doesn't match its folder "${basename(dirname(path))}"` });
  if (!SPEC_STATUSES.includes(spec.status))
    problems.push({ file, message: `status must be one of ${SPEC_STATUSES.join(", ")}; got "${spec.status}"` });
  if (!spec.issues.length) problems.push({ file, message: "frontmatter needs `issues`, every issue that shaped this spec" });
  if (!arr(fm.surfaces).length) problems.push({ file, message: "frontmatter needs `surfaces`" });
  checkSections(file, spec.doc, SPEC_SECTIONS, problems);
  const ac = section(spec.doc, "Acceptance criteria");
  if (ac && !spec.criteria.length)
    problems.push({ file, line: ac.line, message: "no acceptance criteria; write each as `- AC1: <claim>`" });
  if (ac) {
    const stray = listItems(ac.body).filter(i => !/^AC\d+\s*(\(after deploy\))?\s*:/i.test(i));
    for (const s of stray) problems.push({ file, line: ac.line, message: `criterion without an id: "${s.slice(0, 60)}"` });
  }
  const seen = new Set<string>();
  for (const c of spec.criteria) {
    if (seen.has(c.id)) problems.push({ file, message: `criterion id ${c.id} used twice` });
    seen.add(c.id);
  }
  checkMarkers(file, text, problems);
  if (spec.domain) {
    const persona = readPersona(root, spec.domain);
    if (!persona) problems.push({ file, message: `no Persona at docs/personas/${spec.domain}.md` });
  }
  if (spec.status === "approved" && !existsSync(planPathFor(path)))
    problems.push({ file, message: `approved spec has no plan at ${relative(root, planPathFor(path))}` });
  return problems;
}

export function checkPlanFile(root: string, path: string): Problem[] {
  const file = relative(root, path);
  const text = readFileSync(path, "utf8");
  const plan = readPlan(path, text);
  const problems: Problem[] = [];
  if (!plan.doc.frontmatter) return [{ file, message: "no frontmatter" }];
  if (!plan.issue) problems.push({ file, message: "frontmatter needs `issue`" });
  if (plan.budgetUsd === null) problems.push({ file, message: "frontmatter needs a numeric `budget_usd`" });
  checkSections(file, plan.doc, PLAN_SECTIONS, problems);
  checkMarkers(file, text, problems);

  const specPath = specPathFor(path);
  if (!existsSync(specPath)) {
    problems.push({ file, message: `plan has no spec at ${relative(root, specPath)}` });
    return problems;
  }
  const spec = readSpec(specPath);
  if (plan.issue && !spec.issues.includes(plan.issue))
    problems.push({ file, message: `plan issue ${plan.issue} isn't in the spec's \`issues\`` });

  const persona = spec.domain ? readPersona(root, spec.domain) : null;
  if (persona) {
    if (persona.status !== "confirmed")
      problems.push({ file, message: `Persona ${relative(root, persona.path)} is ${persona.status || "unconfirmed"}; plans need confirmed invariants` });
    const listed = new Map(plan.invariants.map(i => [i.id, i.verdict]));
    for (const id of persona.invariants) {
      const v = listed.get(id);
      if (v === undefined) problems.push({ file, message: `invariant ${id} missing from "## Invariants"` });
      else if (!/^holds\b/i.test(v) && !/^exception:\s*\S/i.test(v))
        problems.push({ file, message: `invariant ${id} must start \`holds\` or \`exception: <reason>\`; got "${v}"` });
    }
    for (const id of listed.keys())
      if (!persona.invariants.includes(id)) problems.push({ file, message: `invariant ${id} isn't in the Persona` });
  }

  const tasks = plan.tasks;
  const ids = new Set<string>();
  if (!tasks.length) problems.push({ file, message: "no tasks; write each as `- [ ] t1: <work>. Criteria: AC1`" });
  for (const t of tasks) {
    if (ids.has(t.id)) problems.push({ file, message: `task id ${t.id} used twice` });
    ids.add(t.id);
  }
  const criteria = new Map(spec.criteria.map(c => [c.id, c]));
  for (const t of tasks) {
    if (!t.criteria.length) problems.push({ file, message: `${t.id} names no criteria` });
    for (const c of t.criteria) {
      if (!criteria.has(c)) problems.push({ file, message: `${t.id} names ${c}, which the spec doesn't have` });
      else if (criteria.get(c)!.afterDeploy)
        problems.push({ file, message: `${t.id} names ${c}, an after-deploy criterion; no task makes those true` });
    }
    for (const a of t.after) if (!ids.has(a)) problems.push({ file, message: `${t.id} is after ${a}, which isn't a task` });
  }
  const covered = new Set(tasks.flatMap(t => t.criteria));
  for (const c of spec.criteria)
    if (!c.afterDeploy && !covered.has(c.id)) problems.push({ file, message: `${c.id} isn't covered by any task` });
  const cycle = findCycle(tasks);
  if (cycle) problems.push({ file, message: `tasks wait on each other: ${cycle.join(" → ")}` });
  return problems;
}

export function findCycle(tasks: Task[]): string[] | null {
  const after = new Map(tasks.map(t => [t.id, t.after]));
  const state = new Map<string, 1 | 2>();
  const stack: string[] = [];
  const visit = (id: string): string[] | null => {
    if (state.get(id) === 2) return null;
    if (state.get(id) === 1) return [...stack.slice(stack.indexOf(id)), id];
    state.set(id, 1);
    stack.push(id);
    for (const a of after.get(id) ?? []) {
      if (!after.has(a)) continue;
      const c = visit(a);
      if (c) return c;
    }
    stack.pop();
    state.set(id, 2);
    return null;
  };
  for (const t of tasks) {
    const c = visit(t.id);
    if (c) return c;
  }
  return null;
}

// Tasks in an order where each comes after everything it waits on.
export function taskOrder(tasks: Task[]): Task[] {
  const byId = new Map(tasks.map(t => [t.id, t]));
  const out: Task[] = [];
  const done = new Set<string>();
  const add = (t: Task) => {
    if (done.has(t.id)) return;
    done.add(t.id);
    for (const a of t.after) if (byId.has(a)) add(byId.get(a)!);
    out.push(t);
  };
  tasks.forEach(add);
  return out;
}

export function specFiles(root: string): string[] {
  const dir = join(root, "docs/specs");
  if (!existsSync(dir)) return [];
  const walk = (d: string): string[] =>
    readdirSync(d).flatMap(name => {
      const p = join(d, name);
      return statSync(p).isDirectory() ? walk(p) : p.endsWith(".md") ? [p] : [];
    });
  return walk(dir).sort();
}

export function checkFiles(root: string, paths: string[]): Problem[] {
  return paths.flatMap(p => (isPlan(p) ? checkPlanFile(root, p) : checkSpecFile(root, p)));
}

// Trivial tier: the criteria live in the issue body.
export function checkIssueBody(ref: string, body: string): Problem[] {
  const doc = parseDoc(body);
  const ac = section(doc, "Acceptance criteria");
  const problems: Problem[] = [];
  if (!ac) problems.push({ file: ref, message: 'issue body has no "## Acceptance criteria"' });
  else {
    const criteria = parseCriteria(ac.body);
    if (!criteria.length) problems.push({ file: ref, message: "no acceptance criteria; write each as `- AC1: <claim>`" });
    if (criteria.some(c => c.afterDeploy))
      problems.push({ file: ref, message: "an after-deploy criterion needs the designed tier: a spec with a setup note" });
  }
  checkMarkers(ref, body, problems);
  return problems;
}

export function findPlanForIssue(root: string, issue: { number: number; url: string }): string | null {
  const plans = specFiles(root).filter(isPlan);
  const hit = plans.find(p => {
    const i = readPlan(p).issue;
    return i === issue.url || i.endsWith(`/issues/${issue.number}`) || i === `#${issue.number}`;
  });
  return hit ?? null;
}
