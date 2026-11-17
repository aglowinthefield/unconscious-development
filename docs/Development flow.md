---
status: needs-review
proposed: 2026-11-16
---

UD runs two loops. In the planning loop, you and the Magician decide what work exists, in Obsidian. In the autonomous loop, the cast turns affirmed work into PRs below your attention. You come back in only to review the PR.

## Who owns what

Each kind of state has one owner. Every other place that shows it is a copy with a sync time. The numbered arrows are one piece of work; the blue boxes are UD's jobs on your Mac.

```mermaid
flowchart LR
  Self(["You (the Self)"])

  subgraph Vault["Obsidian vault: planning"]
    direction TB
    Dreams["Dreams and the Magician's judgments<br/>(feasibility, stacking, autonomy, day)"]
    Now["Now pages and item notes<br/>(copies, stamped with sync time)"]
  end

  subgraph GH["GitHub: work state"]
    direction TB
    Issues["Issues and state labels"]
    PRs["PRs, checks, question threads"]
  end

  subgraph Repo["Repo: what and how"]
    Specs["Specs, plans, Personas"]
  end

  subgraph Runners["Runners: execution"]
    direction TB
    Bakery["Bakery"]
    Session["Interactive session"]
    Headless["Headless agent"]
  end

  Dreams -- "1 you affirm a dream" --> Issues
  Issues -- "2 you draft with the Ruler" --> Specs
  Specs -- "3 merged: spec-to-tasks" --> Runners
  Runners -- "4 PR cites the task key" --> PRs
  PRs -- "5 you merge" --> Specs
  Self -.-> Dreams
  Self -.-> PRs

  Magician["Magician, daily"] -- "reads issues and specs,<br/>writes dreams" --> Dreams
  Poller["questions, every 2 min"] -- "asks and applies answers" --> PRs
  Sync["status-page, every 15 min"] -- "reads GitHub and runners,<br/>writes copies" --> Now

  classDef vault fill:#ede7f6,stroke:#7e57c2,color:#311b92
  classDef gh fill:#eceff1,stroke:#546e7a,color:#263238
  classDef repo fill:#e8f5e9,stroke:#43a047,color:#1b5e20
  classDef run fill:#fff3e0,stroke:#fb8c00,color:#e65100
  classDef mac fill:#e3f2fd,stroke:#1e88e5,color:#0d47a1
  class Dreams,Now vault
  class Issues,PRs gh
  class Specs repo
  class Bakery,Session,Headless run
  class Magician,Poller,Sync mac
```

## One piece of work, start to finish

```mermaid
flowchart TD
  subgraph Plan["Planning loop: you and the Magician, in Obsidian"]
    D["Magician dreams up work<br/>from issues, specs, Personas"] --> A{"You affirm it?"}
    A -- "no" --> X["Dropped or deferred"]
    A -- "yes" --> I["Issue: needs-spec"]
    I --> T{"Tier?"}
    T -- "trivial" --> TC["The Ruler drafts criteria into the issue<br/>You add ready-for-agent"]
    T -- "designed" --> SP["Spec PR on spec/&lt;issue&gt;<br/>you and the Ruler draft spec and plan"]
    SP --> Q["Open questions arrive as PR threads<br/>your replies are written into the spec"]
    Q --> C{"check-spec green?"}
    C -- "no: the PR comment says why" --> SP
    C -- "yes" --> M["You merge the spec PR<br/>(merging approves it)"]
  end

  subgraph Auto["Autonomous loop: the cast, below your attention"]
    M --> R["Issue: ready-for-agent<br/>spec-to-tasks makes gh-&lt;issue&gt;/t1…"]
    TC --> R
    R --> RN{"Runner, by autonomy"}
    RN -- "full" --> B["Bakery or a headless agent"]
    RN -- "assisted" --> S["Interactive session"]
    B --> V["Vessel: Creator builds,<br/>Shadow judges criteria and invariants,<br/>Trickster runs what needs a run"]
    S --> V
    V --> PR["Task PR, Refs #issue"]
  end

  PR --> RV{"You review and merge"}
  RV -- "changes" --> V
  RV -- "merged" --> L{"Last task of the plan?"}
  L -- "no" --> R
  L -- "yes" --> AD{"After-deploy criteria?"}
  AD -- "no" --> CL["task-merged: spec built,<br/>plan removed, issue closed"]
  AD -- "yes" --> VF["Issue: verifying<br/>Trickster checks after deploy"]
  VF --> CL

  classDef you fill:#ede7f6,stroke:#7e57c2,color:#311b92
  class A,RV,SP,M,TC you
```

The purple steps are yours. Everything else runs without you.

## Decided since

- A task is done when a merged PR names its key, or its plan box is ticked. `task-merged` finishes the issue from that.
- Who owns what, the key-named branches, and where dreams live: see [[Who owns what]].
