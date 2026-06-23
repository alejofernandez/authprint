# Authprint DSL — Grammar

> The on-disk grammar for `.authprint` files. Format is YAML 1.2 in a strict subset; full vocabulary in [`vocabulary.md`](./vocabulary.md). Rationale: [`decisions/0001-dsl-format.md`](./decisions/0001-dsl-format.md).

## File-level shape

An `.authprint` file is a YAML document whose root IS the flow — **no wrapper key**:

```yaml
id: <string>
name: <string>
description: <string?>     # optional
theme: <light | dark | both>   # default: light
context: { ... }            # default: {}
nodes: [ ... ]              # default: []
edges: [ ... ]              # default: []
annotations: [ ... ]        # default: []
scenarios: [ ... ]          # default: []
```

The file extension `.authprint` is the indicator that the document is a flow; a wrapper key would be redundant.

**Reserved top-level key — `layout`.** A *bundled* `.authprint` (the editor's default single-file save) carries node positions in a top-level `layout:` mapping (`nodeId: { x, y }`) alongside the flow. `layout` is **reserved and ignored by the semantic parser**: it is not part of the data model (Principle 2 — layout is view, not data; `FlowSchema` has no `layout` field), so `parse()` strips it and emits no diagnostic. Editors read `layout` separately to restore positions; a clean *semantic-only* export omits it entirely. See REQUIREMENTS.md §10 (Export packaging).

**Forward-compat for schema-format versioning** (if/when needed): adopt the Kubernetes-style top-level `apiVersion: authprint/vN` field, not a nested wrapper. Not in v1.

## Strict YAML subset

The parser accepts YAML 1.2 with the following restrictions:

| Feature | Status | Reason |
|---|---|---|
| YAML 1.2 only | required | Avoids the Norway problem and other 1.1 quirks |
| Block style | preferred on emit | Reads cleanest in PR diffs |
| Flow style (`{a: 1}`, `[1, 2]`) | accepted on parse, never emitted | Some authors prefer it for short collections |
| Anchors (`&name`) | **rejected** | Footgun for round-trip and validation |
| Aliases (`*name`) | **rejected** | Same |
| Merge keys (`<<: *name`) | **rejected** | Same |
| Tags (`!!str`) | **rejected** | Schema validation handles types |
| Comments (`# …`) | allowed | Encouraged in `annotations` text and around node groups |
| Multi-line scalars (`\|`, `>`) | allowed | Useful for long annotation text |

## Quoting policy

Strings that could be parsed as another type **must be quoted** on emit, even though YAML 1.2 disambiguates them:

- `'true'`, `'false'`, `'on'`, `'off'`, `'yes'`, `'no'` — to avoid boolean confusion.
- `'1'`, `'1.0'`, `'-5'` — to avoid numeric confusion.
- `'null'`, `'~'` — to avoid null confusion.
- Strings containing `:`, `#`, `-`, `?`, `[`, `]`, `{`, `}`, `,`, `&`, `*`, `!`, `|`, `>`, `%`, `@`, backtick — to avoid YAML-syntax confusion.

Otherwise, strings are emitted unquoted.

## Canonical emit order

Object keys are emitted in a stable order to keep diffs meaningful:

1. **Discriminator first** — `type` always emits before everything else.
2. **Identity next** — `id`, then `name`, then `kind`.
3. **Per-type fields** — in the order they appear in the zod schema.
4. **Collections last** — `nodes`, `edges`, `annotations`, `scenarios`.

Arrays preserve declaration order (no canonical sorting of nodes/edges within their array) — preserving the author's intent matters more than imposing canonical order.

## Document conventions

### Node IDs
Strings of the author's choosing. Convention (not enforced):
- `e1`, `e2`, … for entries (only one per flow in v1)
- `s1`, `s2`, … for screens
- `d1`, `d2`, … for decisions
- `a1`, `a2`, … for actions
- `x1`, `x2`, … for externals
- `o1`, `o2`, … for outcomes

Tooling MAY generate UUIDs; humans MAY use slugs. The DSL doesn't enforce a format.

### Edge IDs
Strings. Convention: `edge-1`, `edge-2`, … or `e1→s1` style.

### Self-loops
Forbidden in v1 (`source` must differ from `target`).

### Custom kind values
Accepted for `screen`, `decision`, `action`, `external`, `outcome`. Emit a `vocabulary-unknown-kind` warning at validation time (not an error). See [`vocabulary.md`](./vocabulary.md) for the built-in vocabulary.

### Custom trait identifiers
**Rejected.** The trait vocabulary is closed in v1. See [`vocabulary.md`](./vocabulary.md).

## Document shape (full reference)

```yaml
id: <string>                  # required, non-empty
name: <string>                # required, non-empty
description: <string?>        # optional
theme: <light | dark | both>  # optional, default: light

context:                      # optional, default: {}
  <slot-name>:
    type: <boolean | number | string | enum>
    values: [<string>, ...]   # required iff type=enum

nodes:                        # optional, default: []
  # Entry
  - type: entry
    id: <string>

  # Screen
  - type: screen
    id: <string>
    name: <string>
    kind: <ScreenKind>          # built-in or custom
    traits: [<TraitId>, ...]    # closed set; see vocabulary.md
    fields:
      - name: <string>
        type: <FieldType>       # built-in or custom; see vocabulary.md
        required: <true | false>
    fidelity: <lo-fi | wireframe | mockup>

  # Decision
  - type: decision
    id: <string>
    name: <string?>             # optional
    kind: <DecisionKind>        # built-in or custom
    predicate:
      slot: <string>             # name of a declared Context slot
      op: <PredicateOp>          # see vocabulary.md
      value: <any>               # cross-checked against slot type

  # Action
  - type: action
    id: <string>
    name: <string>
    kind: <ActionKind>          # built-in or custom

  # External
  - type: external
    id: <string>
    name: <string>
    kind: <ExternalKind>        # built-in or custom

  # Outcome
  - type: outcome
    id: <string>
    name: <string>
    kind: <OutcomeKind>         # built-in or custom

edges:                          # optional, default: []
  - id: <string>
    source: <NodeId>
    target: <NodeId>             # must differ from source
    label: <string?>             # optional
    trigger:
      # from entry:
      type: unconditional
      # from screen:
      type: interaction
      action: <UserAction>       # built-in or custom; see vocabulary.md
      # from decision:
      type: branch
      value: <boolean>           # v1: boolean only
      # from action:
      type: on-success | on-error
      # from external:
      type: on-success | on-error | on-denied | on-cancelled

annotations:                    # optional, default: []
  - id: <string>
    kind: <note | rationale>
    text: <string>
    attachment:
      # node-attached:
      type: node
      nodeId: <NodeId>
      # edge-attached:
      type: edge
      edgeId: <EdgeId>
      # floating on canvas:
      type: floating
      x: <number>
      y: <number>

scenarios:                      # optional, default: []
  - id: <string>
    name: <string>
    description: <string?>
    initialContext:
      <slot-name>: <value>       # type per slot declaration
    inputScript:
      # screen step:
      - type: screen
        nodeId: <NodeId>
        action: <string>
      # action step:
      - type: action
        nodeId: <NodeId>
        result: success | error
      # external step:
      - type: external
        nodeId: <NodeId>
        result: success | error | denied | cancelled
    expectedOutcome:             # optional assertion
      outcomeId: <NodeId?>
        sequence: [<NodeId>, ...]?
```

## Layout sidecar

The layout layer (per REQUIREMENTS.md §10) lives in a separate file `<name>.authprint.layout`:

```yaml
layout:
  <nodeId>:
    x: <number>
    y: <number>
```

Same strict YAML subset applies. Nodes without entries fall back to auto-layout (per §7).

## What's not in v1 grammar

- Subflows / cross-flow references.
- Composite predicates (AND/OR/NOT).
- Multiple entry points (model via Entry → Decision).
- Custom trait identifiers.
- Field validators.
- Conditional field visibility.
- Anchor/alias YAML features.
