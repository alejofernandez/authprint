# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `apps/web/node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
# Authprint — agent guide

Bun monorepo for an auth-native flow design tool. **Don't assume** layout from the repo root alone — packages live under `apps/` and `packages/`.

## Repo structure

| Path | Role |
|---|---|
| `apps/web/` | Next.js editor (`@authprint/web`) — React Flow canvas, Y.Doc runtime, palette |
| `packages/dsl/` | `@authprint/dsl` (MIT) — parser, serializer, `validate()` |
| `packages/dsl-spec/` | `@authprint/dsl-spec` (CC-BY 4.0) — grammar, vocabulary, example `.authprint` files |

## Commands (repo root)

| Command | Purpose |
|---|---|
| `bun run dev` | Next.js dev server |
| `bun run build` | Build all packages |
| `bun run lint` | Biome + Next ESLint (`apps/web`) |
| `bun run typecheck` | Typecheck all workspace packages |
| `bun test` | Bun test runner |
| `bun run storybook` | Storybook dev server |
| `bun run test:visual` | Visual-regression (build + headless Chromium + pixel diff) |
| `bun run test:visual:update` | Re-bless baselines → `apps/web/__snapshots__/visual/` |
| `bun run op:run -- <cmd>` | Run `<cmd>` with 1Password-injected env (see `secrets/`) |

## Secrets (local dev)

**Never** add plaintext secrets to `.env` files (gitignored, but easy to leak). Local workflow:

1. `cp secrets/op.env.tpl.example secrets/op.env.tpl` (gitignored)
2. Map `ENV_VAR=op://Vault/Item/field` references in the template
3. `bun run op:run -- bun run dev` — `op inject` resolves refs in memory, merged into child `env`

Full setup: [`secrets/README.md`](./secrets/README.md).

## Editor architecture (where to edit)

| Area | Location |
|---|---|
| Canvas shell + shortcuts | `apps/web/src/components/canvas/Editor.tsx` |
| Y.Doc binding | `apps/web/src/components/canvas/ydoc/useYDocFlow.ts` |
| Mutations (create, connect, attrs) | `apps/web/src/components/canvas/ydoc/ops.ts`, `create.ts` |
| Save/load bundle | `apps/web/src/components/canvas/ydoc/persist.ts` |
| Undo | `apps/web/src/components/canvas/ydoc/useUndoManager.ts` |
| Live validation | `apps/web/src/components/canvas/useValidation.ts`, `ProblemsPanel.tsx` |
| Flow → React Flow | `apps/web/src/components/canvas/flowToReactFlow.ts` |
| Connection sides + handle ids | `apps/web/src/components/canvas/connectionSides.ts` |
| Auto-layout | `apps/web/src/components/canvas/layout.ts` (elkjs) |
| Node views | `apps/web/src/components/canvas/nodes/*` |

Runtime model: **Y.Doc** with `nodes`, `edges`, `context`, `layout` maps. Semantic flow is **derived** from the doc; layout is view state. Local edits use `LOCAL_ORIGIN` transactions (undo + future sync).

## Conventions

### Static visuals → Storybook + pixel baselines

When a deliverable is a **story-able static component** (node view, inline card, overlay — not one-off pages or interaction-only behavior):

1. Author a Storybook story (light + dark where theme matters).
2. Self-verify first render: `bun run test:visual:update`, then **read** the PNG under `apps/web/__snapshots__/visual/`. Baselines assert sameness, not correctness.
3. Commit baselines with the component.
4. On later changes: `bun run test:visual`; re-bless intentional drift with `:update`.

**Interactive behavior** (drag-from-handle, palette, undo, toasts) → verify on the **live dev server**, not Storybook snapshots.

Baselines are **local-only for now** (font/OS-dependent; not in CI until a pinned screenshot environment exists).

### User-facing copy → no em dashes

Never use "—" in any rendered product text (UI strings in `apps/web/messages/`, JSX literals, aria labels, titles, marketing copy). Restructure with commas, colons, or split sentences instead; empty-value placeholder glyphs use an en dash ("–"). Code comments, commit messages, and internal docs are exempt.

### Commit messages → Conventional Commits

Subjects are `type(scope): summary` — imperative, lower-case, no trailing period; `type` from the usual set (`feat`, `fix`, `docs`, `test`, `refactor`, `chore`). Body explains **what + why** (not how — the diff shows how), wrapped at ~72 cols. AI agents co-author their commits with their own real identity trailer (`Co-authored-by:`).

## Known gotchas

| Issue | Mitigation |
|---|---|
| **React Compiler + React Flow** | `reactCompiler: false` in `apps/web/next.config.ts` — Flow's internal `fitView` breaks under the compiler until xyflow ships compiler-safe builds |
| **elkjs under `bun test`** | Bundled elk mistakes Bun for a Web Worker (`globalThis.self`); tests drop `self` before importing elkjs. Browser unaffected |
| **Stale worktree / branch** | Before debugging "it doesn't work", confirm `git status`, branch, and worktree. Dev overlay **⌘0** shows branch + commit |
| **Layout verification** | Don't pixel-diff the full app for ELK layout — render layout to SVG/PNG deterministically, or use Storybook's fixed canvas |
| **Yjs detached maps** | Build/read helpers must run on maps integrated into a doc before `.get()` works in tests |
| **Visual baselines** | Generate and assert on the **same machine** until CI pins fonts/OS |
| **Plaintext secrets in repo** | Use `secrets/op.env.tpl` with `op://` refs only; run via `bun run op:run -- …`. Never `op inject -o .env` |
| **Tailwind v4 `duration-*` utilities** | `--duration-*` in `@theme` does **not** auto-generate named `duration-*` utilities the way `--ease-*` does (`duration-fast` silently resolves to nothing, riding Tailwind's 150ms default). Reference custom duration tokens via arbitrary-value syntax: `duration-[var(--duration-fast)]`. Verify with `getComputedStyle(el).transitionDuration`, not a visual glance |
| **Radix Dialog + commit-on-blur** | Radix's focus trap can redirect focus before a native `blur` reaches React's synthetic `onBlur`, silently dropping the commit through **every** dismiss path. Prefer committing on the dialog's `onOpenChange(false)` (controlled draft + commit-on-close) — the one lifecycle event Radix guarantees |
| **Connection side overrides (US-113+)** | Triggers stay semantic; exit **sides** are layout view state (`edgeLayout.sourceSide`). Relocated branches need their own geometric handle ids (`top-out`, `bottom-out`, `right-out`) — never reuse another branch's semantic id (`false`, `true`). Route **all** `+` / drag-connect / `isValidConnection` through `resolveCreateFromHandle` in `create.ts`, not `triggerFor` alone. Affordance visibility: `connectionSides.ts`; canvas data: `effectiveSourceHandle` → `connectedHandles` plus `usedDecisionBranches` in `flowToReactFlow.ts`. Do not stack two draggable source handles on the same side without `decisionGeometricHandleVisible` hiding the extra one |

## Project docs

`README.md` covers quick start, layout, and licensing. Product/infra planning for the hosted service happens in a private companion repo; this repo is self-contained for building and running the editor.
