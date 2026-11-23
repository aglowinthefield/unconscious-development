// Just enough Markdown for specs, plans and Personas: flat YAML frontmatter, H2 sections,
// list items with indented continuation lines, and pipe tables.

export type Frontmatter = Record<string, string | string[]>;

export interface Doc {
  frontmatter: Frontmatter | null;
  sections: { heading: string; line: number; body: string }[];
}

export function parseDoc(text: string): Doc {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let frontmatter: Frontmatter | null = null;
  let start = 0;
  if (lines[0] === "---") {
    const end = lines.indexOf("---", 1);
    if (end > 0) {
      frontmatter = parseFrontmatter(lines.slice(1, end));
      start = end + 1;
    }
  }
  const sections: Doc["sections"] = [];
  let fence = false;
  for (let i = start; i < lines.length; i++) {
    const line = lines[i];
    if (/^(```|~~~)/.test(line)) fence = !fence;
    const h2 = !fence && /^## (.+?)\s*$/.exec(line);
    if (h2) sections.push({ heading: h2[1], line: i + 1, body: "" });
    else if (sections.length) sections[sections.length - 1].body += line + "\n";
  }
  return { frontmatter, sections };
}

function unquote(v: string): string {
  const t = v.trim();
  if ((t.startsWith('"') && t.endsWith('"')) || (t.startsWith("'") && t.endsWith("'"))) return t.slice(1, -1);
  return t;
}

function parseFrontmatter(lines: string[]): Frontmatter {
  const fm: Frontmatter = {};
  let key: string | null = null;
  for (const line of lines) {
    const item = /^\s+-\s+(.*)$/.exec(line);
    if (item && key) {
      const cur = fm[key];
      fm[key] = Array.isArray(cur) ? [...cur, unquote(item[1])] : [unquote(item[1])];
      continue;
    }
    const kv = /^([A-Za-z_][\w-]*):\s*(.*)$/.exec(line);
    if (!kv) continue;
    key = kv[1];
    const value = kv[2].trim();
    if (value === "") fm[key] = [];
    else if (value.startsWith("[") && value.endsWith("]"))
      fm[key] = value.slice(1, -1).split(",").map(unquote).filter(Boolean);
    else fm[key] = unquote(value);
  }
  return fm;
}

export function section(doc: Doc, heading: string) {
  return doc.sections.find((s) => s.heading.toLowerCase() === heading.toLowerCase());
}

// Top-level list items, each joined with its indented continuation lines.
export function listItems(body: string): string[] {
  const items: string[] = [];
  for (const line of body.split("\n")) {
    const m = /^[-*]\s+(.*)$/.exec(line);
    if (m) items.push(m[1].trim());
    else if (/^\s+\S/.test(line) && items.length) items[items.length - 1] += " " + line.trim();
    else if (line.trim() === "") continue;
    else if (items.length) items.push(""); // prose between items ends the current one
  }
  return items.filter(Boolean);
}

export function tableRows(body: string): string[][] {
  return body
    .split("\n")
    .filter((l) => /^\s*\|/.test(l))
    .map((l) =>
      l
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map((c) => c.trim()),
    )
    .filter((cells) => !cells.every((c) => /^:?-+:?$/.test(c)));
}

export const MARKER = /\[NEEDS CLARIFICATION:[^\]]*\]/g;

export function markers(text: string): { line: number; text: string }[] {
  const found: { line: number; text: string }[] = [];
  text.split("\n").forEach((l, i) => {
    for (const m of l.matchAll(MARKER)) found.push({ line: i + 1, text: m[0] });
  });
  return found;
}
