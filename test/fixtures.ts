import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

export const PERSONA = `---
domain: orders
status: confirmed
---

## Scope

Orders.

## Invariants

| Id | Rule | Sources |
| --- | --- | --- |
| I1 | One. | x |
| I2 | Two. | y |
`;

export const SPEC = `---
domain: orders
status: approved
issues:
  - https://github.com/o/r/issues/412
surfaces:
  - web
---

## Goal

Archive many orders at once.

## Non-goals

- Undo.

## Acceptance criteria

- AC1: Selecting 30 orders and archiving leaves 20 in the list.
- AC2: More than 500 ids is refused with a 400.
- AC3 (after deploy): Archive errors stay under 1 per day for a week.

## Setup note

Seed 50 orders.

## Surfaces touched

- Web

## Cost and scale

none
`;

export const PLAN = `---
issue: https://github.com/o/r/issues/412
budget_usd: 5
---

## Approach

One mutation.

## Data model and contracts

none

## Invariants

- orders/I1: holds
- orders/I2: exception: the bulk path skips the audit hook; approved in review

## Tasks

- [ ] t1: Add the bulk archive mutation with a 500-id limit. Criteria: AC2
- [ ] t2: Add selection and the archive button to the orders list.
      Criteria: AC1. after: t1
`;

export function repo(files: Record<string, string>) {
  const root = mkdtempSync(join(tmpdir(), "ud-"));
  for (const [path, text] of Object.entries(files)) {
    mkdirSync(dirname(join(root, path)), { recursive: true });
    writeFileSync(join(root, path), text);
  }
  return root;
}
