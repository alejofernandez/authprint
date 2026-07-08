<div align="center">

<img src="docs/assets/logo.svg" width="96" alt="Authprint logo" />

# Authprint

**The design tool for authentication flows**

A canvas editor that speaks auth natively, backed by an open, typed DSL.<br />
Flows are data: validated structurally, walked with scenarios, versioned in your repo.

[**Open the editor**](https://editor.authprint.app) · [Website](https://authprint.app) · [DSL spec](./packages/dsl-spec/)

[![Code: MIT](https://img.shields.io/badge/code-MIT-6366f1)](./LICENSE)
[![Spec: CC-BY 4.0](https://img.shields.io/badge/spec-CC--BY_4.0-8b5cf6)](./packages/dsl-spec/LICENSE)
[![CI](https://github.com/alejofernandez/authprint/actions/workflows/ci.yml/badge.svg)](https://github.com/alejofernandez/authprint/actions/workflows/ci.yml)

<picture>
  <source media="(prefers-color-scheme: dark)" srcset="https://authprint.app/assets/editor-dark.png" />
  <img src="https://authprint.app/assets/editor-light.png" width="820"
       alt="The Authprint editor rendering a passkey-enrollment flow with branded screen mockups and live validation" />
</picture>

</div>

Built for Identity PMs, Solutions Architects, and UX designers who need to model auth journeys as typed state machines, not generic diagrams.

> **Status (2026-07-03):** the editor works end-to-end locally (create, connect, edit, undo/redo, save/load `.authprint`, live validation, screen mockups by fidelity tier, scenario walk-throughs) and is live at [editor.authprint.app](https://editor.authprint.app). No account needed; flows stay on your machine.

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
| [`AGENTS.md`](./AGENTS.md) / [`CLAUDE.md`](./CLAUDE.md) | Working on the code (human or AI) — commands, architecture map, conventions, gotchas |
| [`packages/dsl-spec/`](./packages/dsl-spec/) | Understanding the `.authprint` format — grammar, vocabulary, semantics, ADRs |
| [`secrets/README.md`](./secrets/README.md) | Local-dev secrets without `.env` files (1Password refs) |

Product planning and infrastructure for the hosted service live in a private companion repo; this repo is self-contained for building and running the editor.

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

**Secrets (local dev):** no plaintext in `.env` files; use [`secrets/README.md`](./secrets/README.md). Copy `secrets/op.env.tpl.example` → `secrets/op.env.tpl`, add `op://` references, then `bun run op:run -- bun run dev`.

**Example flows** (`.authprint`): [`packages/dsl-spec/examples/`](./packages/dsl-spec/examples/). Demo Flow Zero is the canonical auth spec for a future hosted product.

## Stack (high level)

- **Canvas:** React Flow (`@xyflow/react`) + elkjs auto-layout; **runtime:** Yjs `Y.Doc` (collab-ready, local-only v0)
- **DSL:** YAML 1.2 strict + Zod; `.authprint` extension
- **Tooling:** Bun workspaces, Biome, Lefthook, GitHub Actions CI

Accounts and cloud persistence are **planned**. The current iteration is **local file-based** (no accounts): flows autosave to your browser and export as `.authprint` files.

## License

- **Code** (`apps/web`, `packages/dsl`): [MIT](./LICENSE)
- **DSL specification** (`packages/dsl-spec`): [CC-BY 4.0](./packages/dsl-spec/LICENSE)

No trademark. Personal / open-source project, not affiliated with any employer.
