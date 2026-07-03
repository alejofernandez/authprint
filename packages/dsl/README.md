# @authprint/dsl

Reference TypeScript implementation of the Authprint DSL — types, YAML parser, canonical serializer, and structural validation.

Flows are **auth-aware state machines**: typed nodes (Entry, Screen, Decision, Action, External, Outcome), edges with triggers, context slots, predicates, scenarios, and annotations. See the prose spec in [`@authprint/dsl-spec`](../dsl-spec/).

## Public API (v0)

```ts
import {
  parse,
  serialize,
  validate,
  canExport,
  type Flow,
  type Diagnostic,
} from '@authprint/dsl';
```

| Export | Role |
|---|---|
| `parse(source)` | YAML → `Flow` + parse diagnostics |
| `serialize(flow)` | `Flow` → canonical YAML string |
| `validate(flow)` | Structural checks → `Diagnostic[]` (errors + warnings) |
| `canExport(flow)` | `false` when any error-severity diagnostic exists |

Diagnostics may carry `target?: { kind: 'node' \| 'edge'; id }` for canvas consumers (ring/focus offending elements).

## Layout

```
src/
  schema/          # Zod schemas per spec entity
  validation/      # Graph algorithms (reachability, edges, predicates, …)
  diagnostic.ts    # Shared Diagnostic types + codes
  parser.ts        # YAML + Zod ingest
  serializer.ts    # Deterministic emit
  vocabulary.ts    # Canonical kebab-case values
```

## Tests

```bash
bun test packages/dsl    # from repo root
```

Example flows in `packages/dsl-spec/examples/` should parse, validate cleanly, and round-trip.

## License

MIT — see [`LICENSE`](./LICENSE).
