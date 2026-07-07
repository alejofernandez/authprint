# 0001 — DSL on-disk format

**Status:** Accepted (2026-06-21).
**Deciders:** Alejo (project owner).

## Context

The Authprint DSL is the canonical serialization of a flow (Principle 2: flows are data). The on-disk format had to satisfy several constraints:

- **Scanable in PR diffs** — the audience reviews flows in git. Diff clarity matters.
- **Familiar names** — Principle 7. The format itself shouldn't fight the vocabulary.
- **Round-trippable** — exact AST identity on parse → serialize → parse.
- **Ecosystem-friendly** — third-party tools (codegen, validators, alternate parsers) should be able to consume the format with standard tooling. **Not** require a custom parser per language.
- **Validatable with standard schema tooling** — zod / JSON Schema / Joi-class libraries.
- **Tractable for v1 implementation** — engineering cost matters; parser-from-scratch was a real risk.

## Decision

**YAML 1.2 (strict mode), validated by a zod schema.**

- **Format**: YAML 1.2 (strict) — block style on emit, flow style accepted on parse.
- **Parser**: [`yaml`](https://eemeli.org/yaml/) library (Eemeli Aro) — modern, preserves position info, supports strict 1.2.
- **Schema/validator**: zod — single source for runtime validation AND TypeScript types (via `z.infer`).
- **No anchors, no aliases** — explicitly rejected at parse time. They're a footgun for our round-trip and validation guarantees.
- **Explicit quoting policy** — strings that look numeric or boolean-y (`'true'`, `'1.0'`, `'on'`, `'no'`) get quoted on emit. Eliminates the Norway-problem class of bugs.
- **Canonical formatter on emit** — deterministic key ordering within objects; preserved declaration order for arrays; byte-stable serialization for a given Flow.

## Consequences

### Positive
- Standard tooling everywhere. Any language with a YAML parser can read a flow.
- Zod schema doubles as TypeScript types. Single source of truth.
- Excellent diff readability for PR review.
- Editor support for free (YAML language servers are mature).
- Comments are natural (`#`) and encouraged for `annotations` text.

### Negative
- YAML has more ambient variation than JSON — must lock down a strict subset and emit canonically. Round-trip discipline is on us, not the library.
- More verbose than a hand-rolled DSL would have been.
- Less "auth-flow-shaped" syntax than a custom DSL — the data shape carries the auth semantics, not the surface syntax.

### Mitigations
- Strict parse options (YAML 1.2, `merge: false`, reject anchors/aliases).
- Quoting rules enforced by the serializer.
- Round-trip property tests in the reference implementation (`@authprint/dsl`) exercise the formatter aggressively.

## Alternatives considered

### Custom DSL
**Rejected.** Higher engineering cost (parser, formatter, validator, IDE integrations) for moderate aesthetic benefit. Worst of all, it undercuts the ecosystem story (Principle 2) — third parties consuming Authprint flows would need to implement our parser in their language.

### JSON5
**Rejected.** Closer to ecosystem-friendly than custom DSL, but PR-diff readability is significantly worse than YAML (brace/comma noise, no indentation-as-structure). The audience values diff clarity highly.

### Plain JSON
**Rejected.** No comments, verbose, ergonomic regression vs JSON5.

### TOML
**Rejected.** Awkward for nested data; not common in the dev-tool register the product targets.

## Related

- [Vocabulary](../vocabulary.md) — what names appear in the DSL, per Principle 7.
- [Grammar](../grammar.md) — the strict YAML subset and document shape.
