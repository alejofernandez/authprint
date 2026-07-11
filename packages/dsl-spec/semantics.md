# Authprint DSL — Semantics

> What each construct *means*. The grammar (`grammar.md`) defines what's syntactically allowed; this doc defines what it represents. Targeted at authors of tools that consume Authprint flows (validators, codegen, alternate viewers).
>
> Authoritative for the model. See [`vocabulary.md`](./vocabulary.md) for the curated word list and [`grammar.md`](./grammar.md) for the on-disk shape.

## Core framing

An Authprint **Flow** is a **typed, auth-aware state machine**.

- **Nodes** are states.
- **Edges** are transitions, fired by **triggers** (user actions, decision branches, action/external completions).
- The model **does not execute** anything — Authprint is a design + model-checking tool, not a runtime engine. Context slot *values* exist only inside Scenarios (model-checking inputs), never as real user data.

## Node semantics

### Entry
The flow start. Exactly **one per flow** (validation enforces). Has no kind. Has exactly one outgoing edge with trigger `unconditional`.

### Screen
A **user-facing step**. The user sees the screen, optionally fills in fields, and triggers an `interaction` to transition out.

Composition (three layers):
- **`kind`** — what the screen primarily is (e.g., `password`, `passkey-auth`). Drives icons, defaults, template matching.
- **`traits`** — declarative modifiers about the screen (e.g., `captcha`, `remember-me`). Do not add transitions.
- **`fields`** — atomic inputs/outputs the user interacts with.

A Screen MAY have multiple outgoing edges, one per distinct user action label (`submit`, `cancel`, `back`, etc.).

`fidelity` denotes how richly the screen should render in lo-fi previews. v1 supports `lo-fi`, `wireframe`, `mockup` (the last two are display hints; v1 lo-fi rendering only).

#### Error display on screens

The `error-banner` trait declares that a screen can present the most recent error inline. On the static canvas, wireframe and mockup tiers render a danger-styled alert region with placeholder copy **only when the screen's layout record sets `displayErrorState: true`** (off by default so design-time canvases stay clean). During scenario playback, banner text is **derived from the run** regardless of that flag: a screen entered via an `on-error` edge shows which step failed.

Banner copy resolves through a fallback chain on the failing `action` or `external` node:

1. **`errorMessage`** — optional authored display copy on the node (same category as `name`; omitted from the DSL when unset).
2. **Derived** — `"<node name> failed"` when `errorMessage` is absent.
3. **Placeholder** — generic copy when there is no failing step to derive from (static canvas).

Flows do not mutate context to carry errors. The transient vs terminal distinction is **topology, not an attribute**: an error edge looping back to a screen with `error-banner` models a retryable error; an error edge to a dedicated screen or terminal outcome models a non-transient one.

### Decision
A **branching point with no UI**. The decision evaluates a `predicate` (single typed comparison in v1) over the flow's `Context`. Each outgoing edge carries a `branch` trigger with a value matching one possible predicate outcome.

In v1, predicates always produce boolean outcomes, so a Decision has exactly two outgoing `branch` edges: `value: true` and `value: false`. Multi-branch decisions over enum slots are a v2 extension.

### Action
A **server-side step with no UI**. Represents work the system performs (validate credentials, send an OTP, etc.).

Every Action MUST have **both** outgoing edges:
- `trigger: { type: on-success }`
- `trigger: { type: on-error }`

This mandatory completeness is the model's way of forcing the author to think about failure paths — auth flows live and die by them. Validation enforces.

Optional **`errorMessage`** — static display copy for the `error-banner` trait when this step fails. Omitted from the DSL when unset.

### External
**Hand-off to an external system** (Google sign-in, OIDC provider, etc.). Distinguished from Action because the visual treatment must communicate "the user leaves the flow and returns."

May have outgoing edges with triggers:
- `on-success`
- `on-error`
- `on-denied` (user declined consent or auth was refused)
- `on-cancelled` (user backed out of the external flow)

Not all four are required, but at minimum `on-success` and `on-error` are expected for a well-formed flow.

Optional **`errorMessage`** — same as Action: authored banner copy when this external step fails.

Passkey ceremonies are **inline on a Screen** (kind `passkey-auth` or `passkey-enroll`), NOT modeled as External — the user doesn't truly leave the app the way Google OAuth does.

### Outcome
A **terminal state**. Multiple Outcomes per flow are allowed and expected (success vs denied vs abandoned, etc.). Has no outgoing edges (validation enforces). Built-in kinds map to common terminal states; see `vocabulary.md`.

## Edge semantics

An Edge connects a `source` node to a `target` node via a typed `trigger`. The trigger type MUST be compatible with the source node's structural type — see the table in `vocabulary.md` "Edge trigger types."

Self-loops (`source === target`) are forbidden in v1.

The `label` field is for human-readable context only — not used by any validator or interpreter.

## Context semantics

A Flow declares its Context as a typed slot bag at the flow level. Each slot has a `type` and (for `enum` slots) a `values` list.

**Context slots are declarations only.** They describe what kinds of data the flow's Decisions can reference. They do **not** carry runtime values — Authprint is not an execution engine. Slot values exist only inside Scenarios: `initialContext` plus optional per-step `set:` patches (see Scenario semantics).

## Predicate semantics

A Decision's `predicate` is a **single typed comparison** in v1:

```
{ slot: <slot-name>, op: <PredicateOp>, value: <comparison-value> }
```

The semantics: at decision time, take the slot's current value (from the Scenario's `initialContext` or as mutated by the walk), apply the operator, compare against `value`, and route to the outgoing edge whose `trigger.value` matches the result.

Type compatibility is enforced by the validator (E2): the `value` type must be appropriate for the slot's declared type. `equals`/`not-equals` work for any slot type; `greater-than` and friends work for `number` only; `in`/`not-in` expect `value` to be an array.

Composite predicates (AND/OR/NOT) are explicit v2 work.

## Annotation semantics

Annotations are **sticky-note style notes**, not comments. They carry meta-information ABOUT the flow but do not affect its semantics.

Two kinds in v1:
- `note` — general commentary.
- `rationale` — intended for Decision nodes to explain why a branch exists.

Annotations attach to a node, an edge, or float freely on the canvas via position (`x`, `y`).

Comments (threaded, multi-user, resolvable) are a separate concept — a v1.5 collaboration feature with its own entity, NOT modeled here.

## Scenario semantics

A **Scenario** is a named trace through the flow under declared conditions. Authprint walks the model with the scenario's inputs (model checking, not execution) and asserts about the result.

Composition:
- **`initialContext`** — values for the flow's declared Context slots. Type-checked against slot declarations.
- **`inputScript`** — for each node visited that requires input:
  - `screen` step: which user action label was taken.
  - `action` step: which result (`success` / `error`) to inject.
  - `external` step: which result (`success` / `error` / `denied` / `cancelled`) to inject.
  - Optional **`set:`** on any script step: a patch applied to context **after the step resolves, before the next transition**. Keys must be declared context slots; values are type-checked like `initialContext`. Omitted when unchanged. Enables loops whose predicates must answer differently on a revisit (OTP retry) and before/after checks around a step.
- **`expectedOutcome`** (optional) — assertion about where the trace should end and (optionally) the exact sequence of nodes visited.

The interpreter exposes a **context snapshot per trace step** (aligned with the walker's `trace` array) so UI layers can show how context evolves during playback.

### Walker semantics

The walker starts at `entry` and:
- At `entry`, follows the unconditional edge.
- At `screen`, looks up the input-script step for this node and follows the edge whose `trigger.action` matches.
- At `decision`, evaluates the predicate against current Context and follows the matching `branch` edge.
- At `action`/`external`, looks up the input-script step and follows the `on-<result>` edge.
- Stops at the first `outcome` reached.

If a scenario's `expectedOutcome.outcomeId` is set and the walker reaches a different Outcome, the scenario fails. If `expectedOutcome.sequence` is set and the walker's path differs, the scenario fails at the deviation point.

If the walker reaches a node it has no script step for (or a node not reachable per the model), the scenario fails with a structured error.

## Branding semantics

`flow.branding.theme` declares the **rendering theme of the screens being modeled** — `light`, `dark`, or `both`. This is independent of the editor's own theme (a user editing in light mode may be modeling a dark-themed login). It's grouped under `branding` alongside `companyName`/`primaryColor` because all three describe how the flow's screens present — not tool-level "per-workspace branding", which is deliberately out of scope for v1.

A `both` theme indicates the screens have parallel renderings in both modes; lo-fi previews surface a toggle on each Screen card.

Per-Screen theme overrides are NOT v1 — real auth flows are theme-consistent within themselves.

`companyName` and `primaryColor` are both optional and feed mockup-tier Screen previews only (brand block, CTA color); an unset Flow renders with the existing brand-neutral placeholder.

## Version semantics

A **Version** is an **immutable snapshot** of a Flow at a point in time. Versions are stored separately from the live flow content.

Two version types:
- `auto` — captured automatically (continuous edit history, periodic cross-session backups).
- `named` — user-initiated snapshots with a label (e.g., "v1.0 — passkey rollout"). These are what permalinks pin to and what diffs operate against.

## Extensibility model

| Vocabulary category | Custom values allowed? | On parse |
|---|---|---|
| Structural types | No (closed permanently) | reject unknown values |
| Screen / Decision / Action / External / Outcome kinds | Yes | accept with `vocabulary-unknown-*-kind` warning |
| Trait identifiers | **No** (closed in v1) | reject unknown values |
| Field types | Yes (via `custom` or any string) | accept with `vocabulary-unknown-field-type` warning |
| User action labels | Yes | accept (no warning — they're free-form by design) |
| Predicate operators | No (closed permanently in current scope) | reject unknown values |
| Context slot types | No (closed permanently in current scope) | reject unknown values |
| Edge trigger types | No (closed permanently in current scope) | reject unknown values |
| Annotation kinds | No (closed in v1) | reject unknown values |

Custom kinds render with a generic visual treatment in the canvas. Curated vocabulary additions go through maintainer review.

## What Authprint is NOT

These are non-features by design:

- **Not an execution engine.** Context slot values are declarations; runtime values exist only inside Scenarios.
- **Not a codegen tool** (in v1). The DSL is the input to potential codegen tools, but Authprint itself doesn't produce production code.
- **Not a runtime orchestrator.** Flows are descriptions, not programs to execute.
- **Not a free-form diagram tool.** The model is constrained by structure at every layer.
- **No subflows in v1.** Flows are self-contained; cross-flow references are deferred.
