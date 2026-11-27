// The text of the comments Unconscious Development posts, from Markdown templates. A template in
// UD_COMMENT_TEMPLATES (or ~/.config/unconscious/comments) overrides the one shipped in
// templates/comments. `{{name}}` is replaced by the variable of that name; an unknown one by
// nothing. The tag that lets a later run recognise the comment is added after the template, so
// editing a template can't break it.

import { existsSync, readFileSync } from "node:fs";
import { homedir } from "node:os";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

export type Kind = "check-failed" | "check-passed";

const SHIPPED = join(dirname(fileURLToPath(import.meta.url)), "..", "templates", "comments");

export function templateDirs(): string[] {
  const own = process.env.UD_COMMENT_TEMPLATES ?? join(homedir(), ".config", "unconscious", "comments");
  return [own, SHIPPED];
}

export function loadTemplate(kind: Kind, dirs = templateDirs()): string {
  for (const dir of dirs) {
    const path = join(dir, `${kind}.md`);
    if (existsSync(path)) return readFileSync(path, "utf8");
  }
  throw new Error(`no ${kind}.md comment template in ${dirs.join(" or ")}`);
}

export function render(template: string, vars: Record<string, string | number>): string {
  return template.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, k) => String(vars[k] ?? "")).trim();
}
