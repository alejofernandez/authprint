# @authprint/web

The Authprint **canvas editor** — Next.js app at [`apps/web`](.).

Open [`http://localhost:3000`](http://localhost:3000) after `bun run dev` from the **repo root**.

## What ships today

- **Blank canvas** on load (entry node only); examples via **⌘K** → *Open example*
- **Direct manipulation:** per-handle **+**, drag-from-handle connect, double-click inline editor
- **Undo/redo:** Cmd/Ctrl+Z, Cmd/Ctrl+Shift+Z, Ctrl+Y; palette *Edit* group
- **File persistence:** palette *Save flow* / drag-drop `.authprint` (bundled semantic + layout)
- **Live validation:** Problems badge, click-to-focus diagnostics; optional error rings (eye toggle)
- **Themes:** Light / Dark / System (palette *Appearance*)
- **Dev:** `/dev/nodes` node gallery; **⌘0** build overlay (branch / worktree / commit)

## Key directories

| Path | Purpose |
|---|---|
| `src/components/canvas/` | Editor shell, React Flow binding, palette, validation UI |
| `src/components/canvas/ydoc/` | Y.Doc schema, hydrate, ops, undo, persist |
| `src/components/canvas/nodes/` | Six structural node views + `HandlePlus` |
| `src/stories/` | Storybook stories (node components, light/dark) |
| `__snapshots__/visual/` | Committed visual-regression baselines |

## Commands (from repo root)

```bash
bun run dev              # this app
bun run storybook        # component workbench
bun run test:visual      # pixel-diff stories vs baselines
bun run test:visual:update
```

Workspace `bun test` includes headless tests under `src/components/canvas/`.

## Agent note

This Next.js version may differ from AI training data. Read `node_modules/next/dist/docs/` before writing Next code. See root [`AGENTS.md`](../../AGENTS.md).

## License

MIT — see [`packages/dsl/LICENSE`](../../packages/dsl/LICENSE).
