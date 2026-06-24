# Authprint

**Auth-native flow design tool** — a canvas editor for authentication flows, with a portable DSL underneath. Built for Identity PMs, Solutions Architects, and UX designers who need to model auth journeys as typed state machines, not generic diagrams.

> **Status (2026-06-24):** local editor MVP is working — create, connect, edit, undo/redo, save/load `.authprint`, live validation. See [`STATUS.md`](./STATUS.md) for the full snapshot and what's next.

## Quick start

**Prerequisites:** [Bun](https://bun.sh) (workspace package manager + test runner).

```bash
bun install
bun run dev          # http://localhost:3000 — blank canvas (entry node only)
bun test             # workspace tests (207+)
bun run typecheck
bun run lint
```

**Try it:** open the app → **⌘K** → *Open example* (Demo Flow Zero, passkey enrollment, magic-link sign-in). Create nodes via per-handle **+** or drag-from-handle. **Save flow** downloads a bundled `.authprint` (semantic flow + optional inline `layout:`).

**Dev overlay:** **⌘0** shows branch, worktree, and commit SHA (dev only).

## Monorepo layout

| Path | Package | License | Role |
|---|---|---|---|
| [`apps/web/`](./apps/web/) | `@authprint/web` | MIT | Next.js editor + hosted product |
| [`packages/dsl/`](./packages/dsl/) | `@authprint/dsl` | MIT | DSL types, YAML parser, serializer, `validate()` |
| [`packages/dsl-spec/`](./packages/dsl-spec/) | `@authprint/dsl-spec` | CC-BY 4.0 | Grammar, vocabulary, semantics, example flows |

## Documentation

| Doc | Read when… |
|---|---|
| [`STATUS.md`](./STATUS.md) | Picking the project back up — current state, session log, next steps |
| [`REQUIREMENTS.md`](./REQUIREMENTS.md) | Product scope, architecture, principles (source of truth) |
| [`WORK_BREAKDOWN.md`](./WORK_BREAKDOWN.md) | Implementation plan — phases, epics, active stories |
| [`WORK_BREAKDOWN_DONE.md`](./WORK_BREAKDOWN_DONE.md) | Archived story specs for shipped epics |
| [`COLLABORATION.md`](./COLLABORATION.md) | How to work with the maintainer (humans + AI assistants) |
| [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md) | Agent environment — monorepo commands, conventions, gotchas |
| [`USABILITY.md`](./USABILITY.md) | Ad-hoc UX polish backlog (observed while using the app) |

**AI session workflow:** run `/bootstrap` (`.claude/skills/bootstrap`) at session start; `/teardown` (`.claude/skills/teardown`) before pausing — keeps `STATUS.md` and the WBS aligned with git.

## Development

| Command | What it does |
|---|---|
| `bun run dev` | Next.js dev server |
| `bun run build` | Production build (all packages) |
| `bun run lint` | Biome + Next.js ESLint |
| `bun run typecheck` | Typecheck all workspace packages |
| `bun test` | Bun test runner |
| `bun run storybook` | Storybook component workbench |
| `bun run test:visual` | Visual-regression vs committed PNG baselines |
| `bun run test:visual:update` | Re-bless baselines after intentional visual changes |
| `bun run op:run -- <cmd>` | Run `<cmd>` with secrets from 1Password (no `.env` on disk) |

Visual baselines live under `apps/web/__snapshots__/visual/`. They are **local-only for now** (font/OS-dependent; CI wiring deferred).

**Secrets (local dev):** no plaintext in `.env` files — use [`secrets/README.md`](./secrets/README.md). Copy `secrets/op.env.tpl.example` → `secrets/op.env.tpl`, add `op://` references, then `bun run op:run -- bun run dev`.

**Example flows** (`.authprint`): [`packages/dsl-spec/examples/`](./packages/dsl-spec/examples/) — Demo Flow Zero is the canonical auth spec for a future hosted product.

## Stack (high level)

- **Canvas:** React Flow (`@xyflow/react`) + elkjs auto-layout; **runtime:** Yjs `Y.Doc` (collab-ready, local-only v0)
- **DSL:** YAML 1.2 strict + Zod; `.authprint` extension
- **Tooling:** Bun workspaces, Biome, Lefthook, GitHub Actions CI

Auth, Firestore persistence, and scenarios walk-through are **planned** — see `WORK_BREAKDOWN.md` build sequence. The current iteration is **local file-based** (no accounts).

## License

- **Code** (`apps/web`, `packages/dsl`): [MIT](./packages/dsl/LICENSE)
- **DSL specification** (`packages/dsl-spec`): [CC-BY 4.0](./packages/dsl-spec/LICENSE)

No trademark. Personal / open-source project — not affiliated with any employer.
