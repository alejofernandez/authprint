# 0003 — Scenario context patches (`set:`)

**Status:** Accepted (2026-07-08).
**Deciders:** Alejo (project owner).

## Context

Scenarios walk a flow under declared conditions. Before this decision, context
values were fixed at `initialContext` for the entire run. That made several
real auth journeys untestable at layer 2:

- **Loops** where a predicate must answer differently on a revisit (OTP retry,
  "try another way").
- **Before/after checks** around a step (`user.has_passkey` after enrollment).

Alejo raised this while speccing the scenario player (2026-07-08). The need is
scenario-side: the scenario models how the *environment* evolves during a journey,
not how the flow mutates state at runtime.

Flow-declared effects ("this Action sets `otp.sent`") were considered and
**deferred**. Flows remain pure declarations (model checking, not execution). If
flow-side effects ever land, scenario `set:` becomes the per-test override.

## Decision

Input-script steps gain an optional **`set:`** block: a record of slot patches
applied **after the step resolves, before the next transition**.

```yaml
inputScript:
  - type: screen
    nodeId: s-otp
    action: submit
    set:
      code.valid: true
```

Rules (mirror `initialContext`):

- Keys must reference **declared** context slots on the flow.
- Values are **type-checked** against each slot's declared type.
- Omitted `set` means unchanged; the serializer omits empty blocks so existing
  files stay byte-identical.
- The interpreter exposes a **context snapshot per trace step** (same length as
  `trace`) so walk-through and player UI can show evolution.

The input script remains an **ordered queue**: the same `nodeId` may appear
multiple times (already legal), which is how retry loops are authored.

## Scope (v1)

- **Scenario-side only.** No flow node attributes, no DSL surface on Actions or
  Screens for runtime mutation.
- **Script steps only.** Entry and Decision nodes have no script step; patches
  attach to `screen`, `action`, and `external` steps.
- **No new predicate operators or slot types.**

## Consequences

### Positive

- Layer-2 scenarios can express retry loops and state transitions around a step
  without polluting the flow model.
- Keeps the "flows are pure, scenarios are fixtures" boundary that E48 and the
  scenario player rely on.
- Snapshots give the player and walk-through a single consumption contract for
  context evolution.

### Negative

- Authors must remember patches are scenario-side (not visible on the canvas
  graph). Mitigated by Context panel highlighting at walk-through time.
- Hand-authored `set:` blocks need the same slot/type validation as
  `initialContext` (implemented in layer-1 validation).

### Mitigations

- Validation reuses the existing `initialContext` diagnostic family
  (`validation-scenario-context-slot-undeclared`,
  `validation-scenario-context-value-type-mismatch`).
- Public spec docs (`grammar.md`, `semantics.md`) document apply-instant
  semantics alongside the grammar.

## Alternatives considered

- **Flow-side effects on Action/External nodes.** Rejected for v1: turns flows
  into an execution model; collides with model-checking posture. Explicitly
  deferred; `set:` would override per scenario if this ever ships.
- **`context.lastError` written by the walker.** Rejected (2026-07-09): error
  display is derived from run topology (`on-error` edges + authored
  `errorMessage`), not context mutation. See E49 / `error-banner` trait.
- **Initial + delta snapshots.** Rejected in favor of full context object per
  trace index: simpler for UI consumers (walk-through panel, player context
  column) at negligible cost for typical scenario lengths.

## References

- [Semantics](../semantics.md) — Scenario semantics, walker rules.
- [Grammar](../grammar.md) — `inputScript` step shapes.
