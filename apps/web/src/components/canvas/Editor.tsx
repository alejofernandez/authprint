'use client';

// The Editor: a shell over the React Flow canvas. It owns the current flow as a
// Y.Doc (blank entry-only flow by default, then whatever the user opens), file loading
// (drag-and-drop or the command palette), and the Cmd+K palette that is the
// product's primary navigation surface (§7). elkjs computes auto-layout (LR,
// E17); E24 binds the canvas to the Y.Doc so node moves (→ layout map) and
// deletes (→ cascade) flow into the document. Richer authoring (drag-from-handle
// creation, inline editing) is E26; persistence/serialization is E25.

import '@xyflow/react/dist/style.css';

import { type Diagnostic, type Flow, runScenario } from '@authprint/dsl';
import {
  Background,
  type Connection,
  Controls,
  type FinalConnectionState,
  type IsValidConnection,
  MarkerType,
  MiniMap,
  type NodeMouseHandler,
  type OnConnect,
  type OnConnectEnd,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  type Node as RfNode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { useTranslations } from 'next-intl';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { track } from '@/analytics';
import { useTheme } from '@/components/theme';
import { CommandPalette, type PaletteCommand } from './CommandPalette.tsx';
import { EdgeRouteProvider } from './edges/edgeRouteContext.tsx';
import { RoutableEdge } from './edges/RoutableEdge.tsx';
import { elkLayoutReady } from './elkLayoutReady.ts';
import { flowFromSource } from './flowFromSource.ts';
import { flowToReactFlow, NODE_SIZE, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { type NodeEditActions, NodeInlineEditor } from './NodeInlineEditor.tsx';
import { NodeInspector } from './NodeInspector.tsx';
import { NodeTypePicker, type NodeTypePickerPlacement } from './NodeTypePicker.tsx';
import { NodeCreateProvider, type OpenCreateMenu } from './nodes/HandlePlus.tsx';
import { type CanvasNodeData, nodeTypes } from './nodes/index.ts';
import { NodeActivateProvider } from './nodes/nodeA11y.tsx';
import { ProblemsPanel } from './ProblemsPanel.tsx';
import { ContextPanel } from './scenario/ContextPanel.tsx';
import { ScenarioControls } from './scenario/ScenarioControls.tsx';
import { ScenarioModeProvider, useScenarioMode } from './scenario/ScenarioModeContext.tsx';
import { buildTraceAttachment } from './scenario/scenarioTrace.ts';
import { useScenarioRun } from './scenario/useScenarioRun.ts';
import { useValidation } from './useValidation.ts';
import {
  type CreatableType,
  connectNodes,
  createConnectedNode,
  validateConnection,
} from './ydoc/create.ts';
import { hydrate } from './ydoc/hydrate.ts';
import {
  declareContextSlot,
  setDecisionPredicate,
  setEdgeRoute,
  setNodeKind,
  setNodeName,
  setScreenFidelity,
  setScreenFields,
  setScreenTraits,
} from './ydoc/ops.ts';
import {
  docToArtifact,
  findMatchingSidecar,
  isAuthprintFile,
  isLayoutSidecarFile,
  resolveLayoutForImport,
  serializeBundle,
  serializeSemantic,
  serializeSidecar,
} from './ydoc/persist.ts';
import { shouldDeferUndoToField, useUndoManager } from './ydoc/useUndoManager.ts';
import { useYDocFlow } from './ydoc/useYDocFlow.ts';

export type ExampleFlow = { id: string; name: string; source: string };
export type PatternFlow = ExampleFlow;

const edgeTypes = { routable: RoutableEdge };

// Leave margin around the fitted graph. `maxZoom` caps magnification so a lone
// entry node doesn't blow up to fill the viewport; wide flows still zoom out to
// fit because their ideal zoom is below 1. `initialWidth`/`initialHeight` hints
// on the nodes (see flowToReactFlow) give the first fit correct-enough bounds.
const FIT_VIEW_OPTIONS = { padding: 0.15, maxZoom: 1 } as const;

// `smoothstep` routes edges as clean orthogonal paths (vs the default bezier,
// whose curves overlap and are hard to trace once edges cross). Arrowheads make
// flow direction legible at a glance.
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
} as const;

const FILE_EXT = '.authprint';
const LAYOUT_EXT = '.authprint.layout';
const MIME = 'application/vnd.authprint+yaml';
const LAYOUT_MIME = 'application/vnd.authprint.layout+yaml';
const MAX_BYTES = 2_000_000; // generous guard; real flows are a few KB

// Flow name → safe file stem; never empty.
function slugify(name: string): string {
  const slug = name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'flow';
}

function downloadText(filename: string, content: string, mime: string): void {
  const url = URL.createObjectURL(new Blob([content], { type: mime }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

type Notice = { kind: 'error' | 'info'; title: string; diagnostics: Diagnostic[] };

export function Editor({
  initialFlow,
  examples,
  patterns,
}: {
  initialFlow: Flow;
  examples: ExampleFlow[];
  patterns: PatternFlow[];
}) {
  // ReactFlowProvider hoists the store above the canvas so the palette (a
  // sibling of the canvas) can drive it — e.g. the "Fit view" command.
  return (
    <ReactFlowProvider>
      <EditorShell initialFlow={initialFlow} examples={examples} patterns={patterns} />
    </ReactFlowProvider>
  );
}

function EditorShell({
  initialFlow,
  examples,
  patterns,
}: {
  initialFlow: Flow;
  examples: ExampleFlow[];
  patterns: PatternFlow[];
}) {
  const tPalette = useTranslations('palette');
  const tNotices = useTranslations('notices');
  // The Y.Doc is the editable runtime model (§7). It's built from the parsed
  // Flow and rebuilt wholesale on each load — a fresh document per flow is
  // simpler than diffing one doc into another, and load is a deliberate reset.
  const [doc, setDoc] = useState(() => hydrate(initialFlow));
  // Bumped on every successful load so the canvas remounts and re-runs `fitView`
  // for the new flow (the `fitView` prop only fires on mount).
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const { fitView } = useReactFlow();
  const { theme, setTheme } = useTheme();
  const { undo, redo, canUndo, canRedo } = useUndoManager(doc);
  // Scenario walk-through mode (US-060): null session = edit mode. Owned here so
  // the palette can launch it and the canvas (+ US-061/062) consume it via context.
  const scenario = useScenarioRun();
  // Scenarios travel with the flow (carried opaquely in `meta`, E24). They don't
  // change during a session, so deriving them off `doc` identity is enough.
  const scenarios = useMemo(() => docToArtifact(doc).flow.scenarios ?? [], [doc]);

  // Parse `.authprint` source (and optional layout sidecar) and swap the flow
  // on success; on failure the current flow stays and errors surface in the toast.
  const applyImport = useCallback(
    (authprintSource: string, label: string, sidecarSource?: string): boolean => {
      const { flow: parsed, diagnostics } = flowFromSource(authprintSource);
      if (!parsed) {
        setNotice({ kind: 'error', title: tNotices('parseFailed', { label }), diagnostics });
        return false;
      }
      const { nodes, edges } = resolveLayoutForImport(authprintSource, sidecarSource);
      setDoc(hydrate(parsed, nodes, edges));
      setRevision((r) => r + 1);
      setNotice(
        diagnostics.length
          ? {
              kind: 'info',
              title: tNotices('loadedWithIssues', { label, count: diagnostics.length }),
              diagnostics,
            }
          : null,
      );
      return true;
    },
    [tNotices],
  );

  const applySource = useCallback(
    (source: string, label: string) => {
      applyImport(source, label);
    },
    [applyImport],
  );

  const loadFiles = useCallback(
    async (files: File[]) => {
      const authprints = files.filter((f) => isAuthprintFile(f.name));
      const sidecars = files.filter((f) => isLayoutSidecarFile(f.name));

      if (authprints.length === 0) {
        if (sidecars.length > 0) {
          setNotice({
            kind: 'error',
            title: tNotices('sidecarNeedsMatch', {
              name: sidecars[0]?.name ?? tNotices('layoutFileFallback'),
            }),
            diagnostics: [],
          });
          return;
        }
        setNotice({
          kind: 'error',
          title: tNotices('noFileSelected'),
          diagnostics: [],
        });
        return;
      }

      const primary = authprints[0];
      if (!primary) return;

      if (primary.size > MAX_BYTES) {
        setNotice({
          kind: 'error',
          title: tNotices('fileTooLarge', { name: primary.name }),
          diagnostics: [],
        });
        return;
      }

      const sidecarName = findMatchingSidecar(
        primary.name,
        sidecars.map((f) => f.name),
      );
      const sidecar = sidecarName ? sidecars.find((f) => f.name === sidecarName) : undefined;

      if (sidecar && sidecar.size > MAX_BYTES) {
        setNotice({
          kind: 'error',
          title: tNotices('fileTooLarge', { name: sidecar.name }),
          diagnostics: [],
        });
        return;
      }

      const authprintSource = await primary.text();
      const sidecarSource = sidecar ? await sidecar.text() : undefined;
      const label = sidecar ? `${primary.name} + ${sidecar.name}` : primary.name;
      if (applyImport(authprintSource, label, sidecarSource)) {
        track('flow_opened', { fileName: primary.name, hasSidecar: Boolean(sidecar) });
      }
    },
    [applyImport, tNotices],
  );

  const openFilePicker = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = `${FILE_EXT},${LAYOUT_EXT}`;
    input.multiple = true;
    input.addEventListener('change', () => {
      const selected = input.files ? [...input.files] : [];
      if (selected.length > 0) loadFiles(selected);
    });
    input.click();
  }, [loadFiles]);

  // Cmd/Ctrl+K toggles the palette from anywhere.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setPaletteOpen((open) => !open);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // Canvas undo/redo — defer to native field undo when a text control is focused.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (!(event.metaKey || event.ctrlKey)) return;
      if (shouldDeferUndoToField(event.target)) return;

      const key = event.key.toLowerCase();
      if (key === 'z' && !event.shiftKey) {
        event.preventDefault();
        undo();
      } else if ((key === 'z' && event.shiftKey) || key === 'y') {
        event.preventDefault();
        redo();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [undo, redo]);

  // Stable controls (useCallback in the hook) — destructured so the effects can
  // depend on them precisely rather than the whole (per-render) scenario object.
  const {
    session: scenarioSession,
    exit: exitScenario,
    step: stepScenario,
    back: backScenario,
    reset: resetScenario,
  } = scenario;

  // Scenario-mode keyboard: Esc exits; ← / → walk the trace; R resets. The
  // visual step controls are US-062 — this keeps the mode usable + verifiable now.
  useEffect(() => {
    if (!scenarioSession) return;
    const onKey = (event: KeyboardEvent) => {
      if (paletteOpen) return;
      if (event.key === 'Escape') exitScenario();
      else if (event.key === 'ArrowRight') {
        event.preventDefault();
        stepScenario();
      } else if (event.key === 'ArrowLeft') {
        event.preventDefault();
        backScenario();
      } else if (event.key.toLowerCase() === 'r') {
        resetScenario();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [scenarioSession, exitScenario, stepScenario, backScenario, resetScenario, paletteOpen]);

  // Loading a new flow drops out of scenario mode (the run is for the old flow).
  // biome-ignore lint/correctness/useExhaustiveDependencies: must re-run on each load (revision change), not just on exit identity.
  useEffect(() => {
    exitScenario();
  }, [revision, exitScenario]);

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'undo',
        group: tPalette('groups.edit'),
        label: tPalette('commands.undo'),
        keywords: 'revert back cmd z ctrl',
        disabled: !canUndo,
        run: undo,
      },
      {
        id: 'redo',
        group: tPalette('groups.edit'),
        label: tPalette('commands.redo'),
        keywords: 'restore forward cmd shift z ctrl y',
        disabled: !canRedo,
        run: redo,
      },
      {
        id: 'open-file',
        group: tPalette('groups.file'),
        label: tPalette('commands.openFile'),
        keywords: 'load import',
        run: openFilePicker,
      },
      {
        id: 'save-file',
        group: tPalette('groups.file'),
        label: tPalette('commands.saveFlow'),
        keywords: 'export download write',
        run: () => {
          const artifact = docToArtifact(doc);
          track('flow_saved', { flowName: artifact.flow.name });
          downloadText(
            `${slugify(artifact.flow.name)}${FILE_EXT}`,
            serializeBundle(artifact),
            MIME,
          );
        },
      },
      {
        id: 'export-semantic',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportSemantic'),
        keywords: 'download git clean layout-free diff codegen',
        run: () => {
          const artifact = docToArtifact(doc);
          downloadText(
            `${slugify(artifact.flow.name)}${FILE_EXT}`,
            serializeSemantic(artifact),
            MIME,
          );
        },
      },
      {
        id: 'export-sidecar',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportSidecar'),
        keywords: 'download two files positions layout sidecar',
        run: () => {
          const artifact = docToArtifact(doc);
          const base = slugify(artifact.flow.name);
          const { semantic, layout } = serializeSidecar(artifact);
          downloadText(`${base}${FILE_EXT}`, semantic, MIME);
          downloadText(`${base}${LAYOUT_EXT}`, layout, LAYOUT_MIME);
        },
      },
      {
        id: 'export-bundled',
        group: tPalette('groups.export'),
        label: tPalette('commands.exportBundled'),
        keywords: 'download save default single file bundle',
        run: () => {
          const artifact = docToArtifact(doc);
          downloadText(
            `${slugify(artifact.flow.name)}${FILE_EXT}`,
            serializeBundle(artifact),
            MIME,
          );
        },
      },
      ...patterns.map((pattern) => ({
        id: `pattern-${pattern.id}`,
        group: 'New flow from pattern',
        label: pattern.name,
        keywords: pattern.id,
        run: () => {
          applySource(pattern.source, pattern.name);
        },
      })),
      ...examples.map((example) => ({
        id: `example-${example.id}`,
        group: tPalette('groups.examples'),
        label: tPalette('commands.openExample', { name: example.name }),
        keywords: example.id,
        run: () => {
          track('example_opened', { exampleId: example.id });
          applySource(example.source, example.name);
        },
      })),
      {
        id: 'fit-view',
        group: tPalette('groups.view'),
        label: tPalette('commands.fitView'),
        keywords: 'zoom center reset',
        run: () => fitView(FIT_VIEW_OPTIONS),
      },
      ...(['light', 'dark', 'system'] as const).map((option) => ({
        id: `theme-${option}`,
        group: tPalette('groups.appearance'),
        label: tPalette('commands.theme', {
          name: tPalette(`themes.${option}`),
          mark: theme === option ? '  ✓' : '',
        }),
        keywords: `dark light system appearance ${option}`,
        run: () => setTheme(option),
      })),
      // One command per scenario (a flat-palette pick by name, not a sub-menu —
      // §7 surface call). Runs the interpreter on the *current* flow and enters
      // scenario mode. Empty-state when the flow declares no scenarios.
      ...(scenarios.length > 0
        ? scenarios.map((sc) => ({
            id: `run-scenario-${sc.id}`,
            group: tPalette('groups.scenario'),
            label: tPalette('commands.runScenario', { name: sc.name }),
            keywords: `play walk-through simulate trace test ${sc.id}`,
            run: () =>
              scenario.enter(runScenario(docToArtifact(doc).flow, sc), sc.name, sc.initialContext),
          }))
        : [
            {
              id: 'no-scenarios',
              group: tPalette('groups.scenario'),
              label: tPalette('commands.noScenarios'),
              keywords: 'run play walk-through simulate',
              disabled: true,
              run: () => {},
            },
          ]),
      ...(scenario.session
        ? [
            {
              id: 'exit-scenario',
              group: tPalette('groups.scenario'),
              label: tPalette('commands.exitScenario', { name: scenario.session.name }),
              keywords: 'stop close edit mode esc',
              run: scenario.exit,
            },
          ]
        : []),
    ],
    [
      doc,
      examples,
      patterns,
      openFilePicker,
      applySource,
      fitView,
      theme,
      setTheme,
      undo,
      redo,
      canUndo,
      canRedo,
      scenarios,
      scenario,
      tPalette,
    ],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    const relevant = files.filter((f) => isAuthprintFile(f.name) || isLayoutSidecarFile(f.name));
    if (relevant.length > 0) loadFiles(relevant);
  };

  return (
    <ScenarioModeProvider value={scenario}>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: a file drop zone has no semantic role; the palette's "Open file" command is the keyboard-accessible equivalent. */}
      <div
        className="relative h-dvh w-full bg-zinc-50 dark:bg-zinc-950"
        onDragOver={(e) => {
          e.preventDefault();
          if (!dragging) setDragging(true);
        }}
        onDragLeave={(e) => {
          if (e.currentTarget === e.target) setDragging(false);
        }}
        onDrop={onDrop}
      >
        <FlowCanvas key={revision} doc={doc} />

        <button
          type="button"
          onClick={() => setPaletteOpen(true)}
          aria-label={tPalette('openPalette')}
          className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-md border border-zinc-300 bg-white/80 py-1.5 pr-2 pl-3 text-sm text-zinc-600 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-900"
        >
          {tPalette('searchButton')}
          <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
            ⌘K
          </kbd>
        </button>

        {dragging && (
          <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-indigo-500/10 backdrop-blur-sm">
            <div className="rounded-xl border-2 border-indigo-400 border-dashed bg-white/90 px-8 py-6 font-medium text-indigo-700 dark:bg-zinc-900/90 dark:text-indigo-300">
              {tPalette('dropOverlay')}
            </div>
          </div>
        )}

        {notice && <NoticeToast notice={notice} onDismiss={() => setNotice(null)} />}

        {scenario.session && (
          <>
            <ContextPanel
              initialContext={scenario.session.initialContext}
              divergence={scenario.session.run.divergence}
            />
            <ScenarioControls scenario={scenario} />
          </>
        )}

        <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
      </div>
    </ScenarioModeProvider>
  );
}

function NoticeToast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const tPalette = useTranslations('palette');
  // Warm = error (per the aesthetic: warm colors signal state); indigo = info.
  const isError = notice.kind === 'error';
  return (
    <div
      className={`absolute top-4 left-1/2 z-30 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border p-3 shadow-lg ${
        isError
          ? 'border-amber-300 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/60'
          : 'border-indigo-300 bg-indigo-50 dark:border-indigo-800 dark:bg-indigo-950/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`font-medium text-sm ${isError ? 'text-amber-900 dark:text-amber-200' : 'text-indigo-900 dark:text-indigo-200'}`}
        >
          {notice.title}
        </p>
        <button
          type="button"
          onClick={onDismiss}
          aria-label={tPalette('dismiss')}
          className="text-sm text-zinc-400 leading-none hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
      {notice.diagnostics.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {notice.diagnostics.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static, never-reordered diagnostics list
            <li key={i}>
              {d.path ? `${d.path} — ` : ''}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

// elkjs auto-layout, preserved across edits. We run elk only for nodes that have
// no coordinates yet — everything on first load, and any freshly-added node
// later (E26). A delete or a move never leaves a node unplaced, so layout is NOT
// recomputed for them: the surviving nodes keep their positions, the graph
// doesn't reflow, and — because the hook stops returning null after the first
// layout — `FlowCanvas` never unmounts, so the mount-only `fitView` doesn't
// re-fire. (Previously any structural change re-ran elk and briefly returned
// null, which remounted the canvas and reset the zoom on every delete.)
//
// Returns null only until the very first layout resolves, so the caller holds
// the canvas off rather than painting against empty coordinates.
function useElkLayout(flow: Flow, layout: NodePositionsMap): NodePositionsMap | null {
  // The effect reads the latest flow off a ref so it isn't a dependency — only
  // the set of unplaced nodes should trigger a (re)layout.
  const flowRef = useRef(flow);
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);

  const [positions, setPositions] = useState<NodePositionsMap | null>(null);

  // Sorted ids of nodes still missing coordinates — not yet laid out by elk AND
  // not manually placed (the layout map). A node created via the `+` / drag
  // already has a layout position, so it counts as placed and does NOT trigger a
  // full re-layout: the rest of the graph stays put and only the new node
  // appears where it was dropped. (Empty once everything is placed.)
  const unplaced = flow.nodes
    .filter(
      (node) => (!positions || positions[node.id] === undefined) && layout[node.id] === undefined,
    )
    .map((node) => node.id)
    .sort()
    .join(',');

  useEffect(() => {
    if (unplaced === '') return;
    let cancelled = false;
    layoutFlow(flowRef.current).then((next) => {
      if (!cancelled) setPositions(next);
    });
    return () => {
      cancelled = true;
    };
  }, [unplaced]);

  // Bundled imports place every node in the layout map — elk never runs, but the
  // canvas still needs a non-null map to merge with layout (US-066 regression).
  return elkLayoutReady(positions, unplaced);
}

type CreateMenu = {
  sourceId: string;
  sourceHandle: string | null;
  // How to place the new node: a `+` aligns it to the source along the handle's
  // axis; a drag drops it where the user released.
  placement:
    | { kind: 'aligned'; side: 'right' | 'bottom' }
    | { kind: 'drop'; at: { x: number; y: number } };
};

// Gap (flow units) between a source node and the node its `+` creates.
const NEW_NODE_GAP = 80;

// Place a `+`-created node aligned to its source so the connecting edge reads
// cleanly into the new node's left (target) handle:
//   - right child: to the right, vertical centers level → straight horizontal.
//   - bottom child: below, with its left edge aligned to the source's RIGHT edge
//     so there's room for a clean down-then-right "L" (a smoothstep edge always
//     enters the target from its left handle, so a node directly below would
//     force the arrow to bend back on itself).
// The new node isn't measured yet, so its intrinsic NODE_SIZE seeds the offset.
function alignedNodePosition(
  source: RfNode | undefined,
  side: 'right' | 'bottom',
  type: CreatableType,
): { x: number; y: number } {
  const { height } = NODE_SIZE[type];
  if (!source) return { x: 0, y: 0 };
  const src = source.type
    ? NODE_SIZE[source.type as keyof typeof NODE_SIZE]
    : { width: 0, height: 0 };
  const sw = source.measured?.width ?? src.width;
  const sh = source.measured?.height ?? src.height;
  const { x, y } = source.position;
  return side === 'right'
    ? { x: x + sw + NEW_NODE_GAP, y: y + sh / 2 - height / 2 }
    : { x: x + sw, y: y + sh + NEW_NODE_GAP };
}

function FlowCanvas({ doc }: { doc: Y.Doc }) {
  const {
    flow,
    layout,
    edgeLayout,
    onNodesChange: nodesToDoc,
    onEdgesChange: edgesToDoc,
  } = useYDocFlow(doc);
  const { theme: editorTheme } = useTheme();
  const autoPositions = useElkLayout(flow, layout);
  const validation = useValidation(flow);
  // Scenario mode makes the canvas read-only — no create / drag / delete / inline
  // edit while walking a trace (US-060). US-061 adds the trace styling on top.
  const scenario = useScenarioMode();
  const readOnly = scenario.session !== null;
  // Error outlines on the canvas are opt-in (off while building — the per-handle
  // `+` already hints at incompleteness; the Problems badge tracks the count).
  // Flip them on to review. Gates both node rings and edge recoloring.
  const [showOutlines, setShowOutlines] = useState(false);
  const { getNode, screenToFlowPosition } = useReactFlow();
  const [menu, setMenu] = useState<CreateMenu | null>(null);

  const setEdgeRouteOnDoc = useCallback(
    (edgeId: string, points: { x: number; y: number }[]) => {
      setEdgeRoute(doc, edgeId, points);
    },
    [doc],
  );

  // Dragged + freshly-created nodes (in the layout map) win over auto-placed.
  const graph = useMemo(() => {
    if (!autoPositions) return null;
    const trace =
      scenario.session !== null
        ? buildTraceAttachment(scenario.session.run, scenario.stepIndex)
        : undefined;
    const base = flowToReactFlow(
      flow,
      { ...autoPositions, ...layout },
      edgeLayout,
      showOutlines ? validation : undefined,
      editorTheme,
      trace,
    );
    if (menu?.placement.kind !== 'aligned') return base;
    // Patch picker anchor into node data so React Flow re-renders the `+`.
    return {
      ...base,
      nodes: base.nodes.map((n) =>
        n.id === menu.sourceId
          ? { ...n, data: { ...n.data, pickerAnchorHandle: menu.sourceHandle } }
          : n,
      ),
    };
  }, [
    flow,
    layout,
    edgeLayout,
    autoPositions,
    menu,
    validation,
    showOutlines,
    editorTheme,
    scenario.session,
    scenario.stepIndex,
  ]);

  // A `+` was clicked: record the source handle side so the picker anchors to the
  // node (same placement as the inspector) and the new node aligns on pick.
  const openCreateMenu = useCallback<OpenCreateMenu>((sourceId, sourceHandle, _anchor, side) => {
    setMenu({
      sourceId,
      sourceHandle,
      placement: { kind: 'aligned', side },
    });
  }, []);

  const pickType = useCallback(
    (type: CreatableType) => {
      if (!menu) return;
      const position =
        menu.placement.kind === 'drop'
          ? screenToFlowPosition(menu.placement.at)
          : alignedNodePosition(getNode(menu.sourceId), menu.placement.side, type);
      createConnectedNode(doc, {
        sourceId: menu.sourceId,
        sourceHandle: menu.sourceHandle,
        type,
        position,
      });
      setMenu(null);
    },
    [doc, menu, getNode, screenToFlowPosition],
  );

  // Drag-from-handle onto an existing node → connect only (no new node).
  const onConnect = useCallback<OnConnect>(
    (c: Connection) => {
      connectNodes(doc, { sourceId: c.source, sourceHandle: c.sourceHandle, targetId: c.target });
    },
    [doc],
  );

  // Drag-from-handle released on empty canvas → open the picker there and create
  // a node connected to the drag's source handle. (A drop on a node connects via
  // `onConnect` and leaves `isValid` true, so we skip those here.)
  const onConnectEnd = useCallback<OnConnectEnd>((event, state: FinalConnectionState) => {
    if (state.isValid || !state.fromNode) return;
    const onPane = (event.target as Element | null)?.classList?.contains('react-flow__pane');
    if (!onPane) return;
    const point =
      'changedTouches' in event
        ? { x: event.changedTouches[0]?.clientX ?? 0, y: event.changedTouches[0]?.clientY ?? 0 }
        : { x: event.clientX, y: event.clientY };
    setMenu({
      sourceId: state.fromNode.id,
      sourceHandle: state.fromHandle?.id ?? null,
      placement: { kind: 'drop', at: point },
    });
  }, []);

  const isValidConnection = useCallback<IsValidConnection>(
    (c) => validateConnection(flow, c),
    [flow],
  );

  // Double-click a node → node-anchored inspector (Entry has nothing to edit).
  const [editingId, setEditingId] = useState<string | null>(null);
  const onNodeDoubleClick = useCallback<NodeMouseHandler>((_event, node) => {
    if (node.type === 'entry') return;
    setEditingId(node.id);
  }, []);

  const onNodeActivate = useCallback(
    (nodeId: string) => {
      const target = flow.nodes.find((n) => n.id === nodeId);
      if (!target || target.type === 'entry') return;
      setEditingId(nodeId);
    },
    [flow.nodes],
  );

  const editActions = useMemo<NodeEditActions>(
    () => ({
      setName: (id, v) => setNodeName(doc, id, v),
      setKind: (id, v) => setNodeKind(doc, id, v),
      setFidelity: (id, v) => setScreenFidelity(doc, id, v),
      setTraits: (id, v) => setScreenTraits(doc, id, v),
      setFields: (id, v) => setScreenFields(doc, id, v),
      setPredicate: (id, p) => setDecisionPredicate(doc, id, p),
      declareSlot: (name, slot) => declareContextSlot(doc, name, slot),
    }),
    [doc],
  );

  const editingNode = editingId ? flow.nodes.find((n) => n.id === editingId) : undefined;

  const pickerPlacement = useMemo((): NodeTypePickerPlacement | null => {
    if (!menu) return null;
    return menu.placement.kind === 'aligned'
      ? { kind: 'node', sourceId: menu.sourceId, side: menu.placement.side }
      : { kind: 'point', at: menu.placement.at };
  }, [menu]);

  if (!graph) return null;

  return (
    // In scenario mode the `+` affordances vanish (HandlePlus renders nothing
    // without a create handler), reinforcing read-only.
    <EdgeRouteProvider setRoute={readOnly ? null : setEdgeRouteOnDoc}>
      <NodeActivateProvider value={readOnly ? null : onNodeActivate}>
        <NodeCreateProvider value={readOnly ? null : openCreateMenu}>
          <BoundCanvas
            graph={graph}
            nodesToDoc={nodesToDoc}
            edgesToDoc={edgesToDoc}
            onConnect={onConnect}
            onConnectEnd={onConnectEnd}
            isValidConnection={isValidConnection}
            onNodeDoubleClick={readOnly ? undefined : onNodeDoubleClick}
            readOnly={readOnly}
          />
          <ProblemsPanel
            validation={validation}
            showOutlines={showOutlines}
            onToggleOutlines={() => setShowOutlines((v) => !v)}
          />
          {!readOnly && pickerPlacement && (
            <NodeTypePicker
              placement={pickerPlacement}
              onPick={pickType}
              onClose={() => setMenu(null)}
            />
          )}
          {!readOnly && editingId && editingNode && (
            <NodeInspector
              key={editingId}
              nodeId={editingId}
              node={editingNode}
              onClose={() => setEditingId(null)}
            >
              <NodeInlineEditor node={editingNode} context={flow.context} actions={editActions} />
            </NodeInspector>
          )}
        </NodeCreateProvider>
      </NodeActivateProvider>
    </EdgeRouteProvider>
  );
}

// Mounted only once coordinates are ready, so its local node/edge state seeds
// with the full graph and `fitView` fits real bounds on the first frame. Holds
// React Flow's interactive state locally (smooth drag) while mirroring every
// change into the Y.Doc; external Y.Doc changes flow back via the `graph` prop.
function BoundCanvas({
  graph,
  nodesToDoc,
  edgesToDoc,
  onConnect,
  onConnectEnd,
  isValidConnection,
  onNodeDoubleClick,
  readOnly,
}: {
  graph: ReturnType<typeof flowToReactFlow>;
  nodesToDoc: OnNodesChange<RfNode<CanvasNodeData>>;
  edgesToDoc: OnEdgesChange;
  onConnect: OnConnect;
  onConnectEnd: OnConnectEnd;
  isValidConnection: IsValidConnection;
  onNodeDoubleClick?: NodeMouseHandler;
  /** Scenario mode (US-060): disable all editing; pan/zoom stay live. */
  readOnly?: boolean;
}) {
  const [nodes, setNodes, onNodesChangeLocal] = useNodesState(graph.nodes);
  const [edges, setEdges, onEdgesChangeLocal] = useEdgesState(graph.edges);

  // Reconcile when the Y.Doc-derived graph changes (a committed drag, a delete,
  // a remote edit). Steady state is stable refs, so this doesn't loop.
  useEffect(() => setNodes(graph.nodes), [graph.nodes, setNodes]);
  useEffect(() => setEdges(graph.edges), [graph.edges, setEdges]);

  const onNodesChange = useCallback<OnNodesChange<RfNode<CanvasNodeData>>>(
    (changes) => {
      onNodesChangeLocal(changes); // local echo: smooth drag + selection
      nodesToDoc(changes); // commit move-on-end / delete to the doc
    },
    [onNodesChangeLocal, nodesToDoc],
  );
  const onEdgesChange = useCallback<OnEdgesChange>(
    (changes) => {
      onEdgesChangeLocal(changes);
      edgesToDoc(changes);
    },
    [onEdgesChangeLocal, edgesToDoc],
  );

  return (
    <ReactFlow
      nodes={nodes}
      edges={edges}
      onNodesChange={onNodesChange}
      onEdgesChange={onEdgesChange}
      onConnect={onConnect}
      onConnectEnd={onConnectEnd}
      isValidConnection={isValidConnection}
      onNodeDoubleClick={onNodeDoubleClick}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={!readOnly}
      nodesConnectable={!readOnly}
      elementsSelectable={!readOnly}
      deleteKeyCode={readOnly ? null : ['Delete', 'Backspace']}
      defaultEdgeOptions={DEFAULT_EDGE_OPTIONS}
      fitView
      fitViewOptions={FIT_VIEW_OPTIONS}
      // Default minZoom (0.5) is too high to fit wide flows — a long
      // sequence needs to zoom further out, else fitView clips the ends.
      minZoom={0.1}
    >
      <Background gap={24} size={1} />
      <Controls position="bottom-left" showInteractive={false} />
      <MiniMap position="bottom-right" pannable zoomable />
    </ReactFlow>
  );
}
