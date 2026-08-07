# Authprint DSL — Grammar

> The on-disk grammar for `.authprint` files. Format is YAML 1.2 in a strict subset; full vocabulary in [`vocabulary.md`](./vocabulary.md). Rationale: [`decisions/0001-dsl-format.md`](./decisions/0001-dsl-format.md).

## File-level shape

An `.authprint` file is a YAML document whose root IS the flow — **no wrapper key**:

```yaml
id: <string>
name: <string>
description: <string?>     # optional
branding:                  # flow-level; feeds mockup-tier Screen previews
  theme: <light | dark | both>   # default: light
  companyName: <string?>   # optional
  primaryColor: <colour?>  # optional; hex / rgb(a)|hsl(a) / CSS name
context: { ... }            # default: {}
nodes: [ ... ]              # default: []
edges: [ ... ]              # default: []
annotations: [ ... ]        # default: []
scenarios: [ ... ]          # default: []
```

The file extension `.authprint` is the indicator that the document is a flow; a wrapper key would be redundant.

## Structural ceilings (Tier 1)

Hard limits in the schema and at the file-open boundary. They reject corruption and denial-of-service payloads; they are **not** taste constraints. Soft advisories for "this title is awkwardly long" belong in a separate validator tier and are not specified here.

| Bound | Ceiling |
|---|---|
| Whole-file source (picker / drop, before parse) | 2,000,000 bytes |
| Identifiers (`id`, `kind`, `action`, slot names, field `type` / `name`) | 128 characters |
| `name`, edge `label`, `branding.companyName` | 4096 characters |
| `description`, `errorMessage`, `Annotation.text` | 8192 characters |
| Action / External `notes` | 32768 characters |
| Context / predicate / patch string scalars | 4096 characters |
| `nodes` | 10000 |
| `edges` | 20000 |
| `annotations` | 5000 |
| `scenarios` | 500 |
| Scenario `inputScript` steps | 2000 |
| Fields per Screen | 200 |
| Context slots (and keys on `initialContext` / step `set`) | 500 |
| Enum slot `values` (and `in` / `not-in` predicate arrays) | 200 |
| `expectedOutcome.sequence` | 2000 |
| Layout coordinates (`x` / `y`) | ±1×10⁷ (clamped on load) |

`branding.primaryColor`, when present, must be one of:

- Hex: `#` + 3, 4, 6, or 8 hex digits
- `rgb()` / `rgba()` / `hsl()` / `hsla()` with numeric (optionally `%`) comma-separated arguments
- A bare CSS colour name: `[a-z]{3,20}` (cannot contain `(`, `:`, or `/`, so it cannot smuggle a function)

Everything else is a schema violation. Predicate / context / patch values are scalars (`boolean` | finite `number` | string), except `in` / `not-in` which take a bounded array of scalars. Nested objects are rejected at parse.

**Reserved top-level key — `layout`.** A *bundled* `.authprint` (the editor's default single-file save) carries node positions in a top-level `layout:` mapping (`nodeId: { x, y, … }`) alongside the flow. `layout` is **reserved and ignored by the semantic parser**: it is not part of the data model (Principle 2 — layout is view, not data; `FlowSchema` has no `layout` field), so `parse()` strips it and emits no diagnostic. Editors read `layout` separately to restore positions and per-node view flags; a clean *semantic-only* export omits it entirely.

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

branding:                     # optional; flow-level, feeds mockup-tier Screen previews
  theme: <light | dark | both>  # optional, default: light
  companyName: <string?>      # optional
  primaryColor: <string?>     # optional

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
    errorMessage: <string?>     # optional authored copy for error-banner screens
    notes: <string?>            # optional free text; markdown subset (see below)

  # External
  - type: external
    id: <string>
    name: <string>
    kind: <ExternalKind>        # built-in or custom
    errorMessage: <string?>     # optional authored copy for error-banner screens
    notes: <string?>            # optional free text; markdown subset (see below)

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
        set:                          # optional; applied after this step resolves
          <slot-name>: <value>
      # action step:
      - type: action
        nodeId: <NodeId>
        result: success | error
        errorMessage: <string?>       # optional: banner copy for this failure
        set:                          # optional
          <slot-name>: <value>
      # external step:
      - type: external
        nodeId: <NodeId>
        result: success | error | denied | cancelled
        errorMessage: <string?>       # optional: banner copy for this failure
        set:                          # optional
          <slot-name>: <value>
    expectedOutcome:             # optional assertion
      outcomeId: <NodeId?>
        sequence: [<NodeId>, ...]?
```

## Layout sidecar

The layout layer lives in a separate file `<name>.authprint.layout`:

```yaml
nodes:
  <nodeId>:
    x: <number>
    y: <number>
    displayErrorState: <boolean?>   # optional; screen preview only
edges:
  <edgeId>:
    - x: <number>
      y: <number>
```

Bundled `.authprint` files use the same shape under a top-level `layout:` key (nested `nodes` / `edges` blocks). Legacy flat node maps (`layout: { nodeId: { x, y } }`) remain valid.

**Node layout fields**

| Field | Applies to | Default | Meaning |
|---|---|---|---|
| `x`, `y` | all nodes | — | Canvas position |
| `displayErrorState` | screens with `error-banner` | `false` (omitted) | When `true`, the screen shows the error-banner preview on the static canvas. Scenario playback shows the banner regardless (derived from the run). |

Same strict YAML subset applies. Nodes without entries fall back to auto-layout.

## Node `notes` (Action and External only)

`notes` is an optional free-text string on **Action** and **External** nodes. It is semantic (lives in the `.authprint` file), not layout. Screens, Decisions, Outcomes, and Entry do not carry `notes`.

Absent and empty are the same on write: never emit `notes: ''`. Multi-line values typically emit as YAML literal block scalars (`|` / `|-`); that is ordinary YAML, not a special Authprint construct.

### Markdown subset

Notes are authored as raw markdown. Implementations that render notes **must** support only this closed subset, and **must never** render the excluded constructs as interactive or fetchable content.

**Supported:**

- Headings (`#`–`###`)
- Bold and italic
- Inline code and fenced code blocks
- Bullet lists and ordered lists

**Never rendered (at any level of the stack):**

- Links of every form (inline, reference, autolink, bare URL)
- Images
- Raw or embedded HTML
- Tables, blockquotes, footnotes, horizontal rules
- Anything that carries a URL, or that can cause a fetch

Excluded syntax degrades to its text content (with any URL dropped). Example: `[docs](https://example.com)` shows as `docs`, not as a link.

**Hard line breaks via two trailing spaces are not supported.** They survive YAML block scalars, but any whitespace-trimming tool silently destroys them. Authors should use a blank line instead.

## What's not in v1 grammar

- Subflows / cross-flow references.
- Composite predicates (AND/OR/NOT).
- Multiple entry points (model via Entry → Decision).
- Custom trait identifiers.
- Field validators.
- Conditional field visibility.
- Anchor/alias YAML features.
