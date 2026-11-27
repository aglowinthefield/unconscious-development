---
status: accepted
proposed: 2026-11-16
---

UD runs two loops. In the planning loop, you decide what work exists: on GitHub, or in Obsidian with the Magician if you use it. In the autonomous loop, the cast turns that work into PRs. You come back in only to review the PR.

## Where things live

GitHub and your repo are all you need. Obsidian and a runner are optional add-ons, drawn dashed. The numbered arrows are one piece of work.

```mermaid
flowchart LR
  Self(["You"])

  subgraph GH1["GitHub"]
    Issues["Issue<br/>(state label)"]
  end

  subgraph Repo["Your repo"]
    Specs["Spec, plan, Persona"]
  end

  subgraph Do["Who does the task"]
    direction TB
    Session["A session you start"]
    Alice["Runner (optional):<br/>Alice or a headless agent"]
  end

  subgraph GH2["GitHub"]
    PRs["PR, checks,<br/>question threads"]
  end

  subgraph Vault["Obsidian (optional)"]
    direction TB
    Proposals["Proposals and planning notes<br/>(yours and the Magician's)"]
    Copies["gh_ and run_ properties<br/>(copies, overwritten on sync)"]
  end

  Self -- "1 open an issue" --> Issues
  Issues -- "2 spec it<br/>with the Ruler" --> Specs
  Specs -- "3 merged:<br/>tasks handed out" --> Session
  Specs -.-> Alice
  Session -- "4 PR names<br/>the task key" --> PRs
  Alice -.-> PRs
  PRs -- "5 you merge; the last task closes the issue" --> Issues

  Proposals -. "you accept a proposal" .-> Issues
  Issues -. "status-page copies" .-> Copies

  classDef core fill:#eceff1,stroke:#546e7a,color:#263238
  classDef repo fill:#e8f5e9,stroke:#43a047,color:#1b5e20
  classDef opt fill:#fafafa,stroke:#9e9e9e,stroke-dasharray:5 4,color:#424242
  class Issues,PRs,Session core
  class Specs repo
  class Proposals,Copies,Alice opt
  style Vault stroke-dasharray:5 4
```

## One piece of work, start to finish

```mermaid
flowchart TD
  subgraph Plan["Planning loop: you, with the Magician if you use Obsidian"]
    D["Magician proposes work<br/>from issues, specs, Personas"] --> A{"You accept it?"}
    A -- "no" --> X["Dropped or deferred"]
    A -- "yes" --> I["Issue: needs-spec"]
    I --> T{"Tier?"}
    T -- "trivial" --> TC["The Ruler drafts criteria into the issue<br/>You add ready-for-agent"]
    T -- "designed" --> SP["Spec PR on spec/&lt;issue&gt;<br/>you and the Ruler draft spec and plan"]
    SP --> Q["Open questions: the Ruler asks you<br/>and writes your answers into the spec"]
    Q --> C{"check-spec green?"}
    C -- "no: the PR comment says why" --> SP
    C -- "yes" --> M["You merge the spec PR<br/>(merging approves it)"]
  end

  subgraph Auto["Autonomous loop: the cast"]
    M --> R["Issue: ready-for-agent<br/>spec-to-tasks makes gh-&lt;issue&gt;/t1…"]
    TC --> R
    R --> RN{"Runner, by autonomy"}
    RN -- "full" --> B["Alice or a headless agent"]
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
- How UD, Alice, and Impression split the work, and where state lives: see [[Who owns what]].
