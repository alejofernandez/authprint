# 0002 — Custom vocabulary declaration & promotion

**Status:** Accepted (2026-06-29).
**Deciders:** Alejo (project owner).

## Context

Two-layer typing (REQUIREMENTS.md §5) makes structural node types a **closed** set
and `kind` tags an **open**, extensible one. The DSL accepts custom kinds; the
validator emits a `vocabulary-unknown-*-kind` **warning** (not an error) for any
`kind` that isn't built-in.

That warning has a structural flaw: from a bare string it cannot distinguish

- a **typo** (`send-otpp`) — which the author *wants* flagged, from
- a **deliberate** domain kind (`biometric-gate`) — which they don't.

Both are "not built-in," so both warn — forever. The result nags exactly the
users doing the most valuable thing (extending the vocabulary), and offers no
path to (a) sanction an intentional custom kind so it stops warning, or (b) grow
the built-in vocabulary from observed real-world usage.

§6 Layer 1 already specifies vocabulary correctness as *"every `kind` … is either
built-in **or explicitly declared custom**."* The phrase was aspirational — no
declaration mechanism existed. This ADR supplies it.

A related symptom (the editor stamping `kind: custom` on freshly created nodes,
producing a self-contradictory warning) is fixed independently by giving new
nodes sensible built-in default kinds (WBS US-081); it is **not** part of this
ADR, though it removed the most common spurious instance of the warning.

## Decision

Introduce a per-flow **`vocabulary:` declaration block**.

- **Where it lives.** A new optional top-level key on the `Flow` — part of
  `FlowSchema`, not a sidecar. Vocabulary is **semantic** (it changes what the
  flow *means*), so unlike `layout:` (view state, §7 / Principle 2) it travels in
  **every** export — semantic-only, sidecar, and bundled alike.
- **Shape.** Declared custom identifiers, grouped by **open category**, as bare
  strings in v1:

  ```yaml
  vocabulary:
    screenKinds: [biometric-gate, kiosk-unlock]
    decisionKinds: []
    actionKinds: [risk-score]
    externalKinds: []
    outcomeKinds: []
    fieldTypes: []
  ```

  Default-empty and **omitted on serialize** when empty, so a flow with no custom
  vocabulary is byte-identical to today.
- **Validator semantics.** For a node of structural type `T` with `kind = k`:

  | `k` is… | Diagnostic |
  |---|---|
  | a built-in (`isBuiltinTKind(k)`) | none |
  | present in `flow.vocabulary.Tkinds` (declared custom) | **none** — silent |
  | neither | `vocabulary-unknown-T-kind` **warning**, reworded + actionable |

  A *declared* kind is the intent signal the validator previously lacked: declared
  ⇒ deliberate ⇒ silent; undeclared non-built-in ⇒ unknown ⇒ warn. Two optional
  tidy lints fall out: `vocabulary-redundant-declaration` (a declared kind that is
  *also* now built-in — safe to remove, typically post-promotion) and
  `vocabulary-unused-declaration` (declared but used by no node).
- **Editor UX — declaration follows intent.** The existing `KindSelect`
  "Custom…" branch becomes the declaration trigger: committing a non-built-in
  value via "Custom…" writes it into `flow.vocabulary.<category>`. Choosing
  "Custom…" *is* the intent assertion, so anything authored in the app is
  warning-free by construction. Declarations are **not** auto-pruned when their
  last user is deleted (a surprising silent edit); the `unused-declaration` info
  lint surfaces cleanup instead.
- **Promotion path.** Declared customs are the candidate pool for growing the
  built-in vocabulary. Popular ones are curated into the `*_KINDS_BUILTIN` arrays
  (`@authprint/dsl`) + the `vocabulary.md` tables via **maintainer review** — the
  same governance traits already use ("additions go through review"). Graduation
  is graceful: a promoted kind becomes built-in, which makes any existing
  declaration redundant (info lint), and nothing breaks.

## Scope (v1)

- **Open layers only:** `screenKinds`, `decisionKinds`, `actionKinds`,
  `externalKinds`, `outcomeKinds`, `fieldTypes`.
- **Closed sets unchanged:** traits, predicate operators, context-slot types, and
  structural types remain non-declarable (they define graph semantics).

## Consequences

### Positive
- Resolves the typo-vs-intent ambiguity through an explicit declaration rather
  than a heuristic.
- Custom kinds become first-class and warning-free once declared; the warning is
  retained as a genuine typo guard for undeclared values.
- Per-flow declarations **double as the demand signal** for language growth — once
  a backend exists, aggregating them across flows ranks promotion candidates.
- Realizes the existing §6 *"or explicitly declared custom"* phrasing.

### Negative
- Adds a semantic field that appears in every export (kept invisible when empty).
- Editor auto-declare takes the author at their word: a typo entered via "Custom…"
  is declared and goes silent — so in-editor authoring narrows the warning's reach
  to **hand-authored / imported** files. Accepted: picking "Custom…" is a
  deliberate act.
- Declarations can drift (unused / redundant) — mitigated by the tidy lints.

### Mitigations
- `VocabularySchema` defaults empty + serializer omits empties → minimal flows are
  byte-identical to pre-feature output.
- `apiVersion: authprint/vN` is the lever if the block's shape ever changes
  incompatibly (e.g. to the object form below).

## Alternatives considered

- **Status quo — warn on all non-built-in kinds.** Rejected: nags intentional
  customs forever; no growth path.
- **Go silent on kinds (no warning).** Rejected: loses typo-catching, and future
  codegen / pattern-matching key on built-in kinds — a typo would degrade from
  cosmetic to a silent semantic miss.
- **An unset/`custom` sentinel kind.** Rejected: conflates with the built-in
  field-type `custom`; marks a kind as "unchosen" but never captures a *real*
  custom kind.
- **Project / global vocabulary first.** Deferred, not rejected: needs the
  account / persistence model (Phase III+). The per-flow block is the v1 rung and
  is forward-compatible with a future precedence union (`built-in ∪ project ∪
  flow`).
- **Object-form declarations** (`{ id, label, description }` for display /
  autocomplete) and **named extension packs** (`@authprint/vocab-*`). Deferred as
  later rungs; `apiVersion` covers the upgrade.

## Related

- [Vocabulary — Extension model](../vocabulary.md) — the normative description of
  declaration + promotion.
- [REQUIREMENTS.md §5 Flow-level attributes](../../../REQUIREMENTS.md) — the
  `vocabulary` Flow attribute.
- [REQUIREMENTS.md §6 Layer 1](../../../REQUIREMENTS.md) — declared-vs-undeclared
  vocabulary correctness.
- [ADR 0001 — DSL on-disk format](./0001-dsl-format.md) — the YAML/zod substrate
  this extends.
- WBS **E41 — Custom vocabulary declaration & promotion** — the implementation.
