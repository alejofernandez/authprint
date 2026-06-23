'use client';

// The Editor: a shell over the React Flow canvas. It owns the current flow as a
// Y.Doc (Demo Flow Zero by default, then whatever the user opens), file loading
// (drag-and-drop or the command palette), and the Cmd+K palette that is the
// product's primary navigation surface (§7). elkjs computes auto-layout (LR,
// E17); E24 binds the canvas to the Y.Doc so node moves (→ layout map) and
// deletes (→ cascade) flow into the document. Richer authoring (drag-from-handle
// creation, inline editing) is E26; persistence/serialization is E25.

import '@xyflow/react/dist/style.css';

import type { Diagnostic, Flow } from '@authprint/dsl';
import {
  Background,
  Controls,
  MarkerType,
  MiniMap,
  type OnEdgesChange,
  type OnNodesChange,
  ReactFlow,
  ReactFlowProvider,
  type Node as RfNode,
  useEdgesState,
  useNodesState,
  useReactFlow,
} from '@xyflow/react';
import { type DragEvent, useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type * as Y from 'yjs';
import { type Theme, useTheme } from '@/components/theme';
import { CommandPalette, type PaletteCommand } from './CommandPalette.tsx';
import { flowFromSource } from './flowFromSource.ts';
import { flowToReactFlow, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { type CanvasNodeData, nodeTypes } from './nodes/index.ts';
import { hydrate } from './ydoc/hydrate.ts';
import { useYDocFlow } from './ydoc/useYDocFlow.ts';

export type ExampleFlow = { id: string; name: string; source: string };

const edgeTypes = {};

// Leave margin around the fitted graph. `initialWidth`/`initialHeight` hints on
// the nodes (see flowToReactFlow) give the first fit correct-enough bounds.
const FIT_VIEW_OPTIONS = { padding: 0.15 } as const;

// `smoothstep` routes edges as clean orthogonal paths (vs the default bezier,
// whose curves overlap and are hard to trace once edges cross). Arrowheads make
// flow direction legible at a glance.
const DEFAULT_EDGE_OPTIONS = {
  type: 'smoothstep',
  markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18 },
} as const;

const FILE_EXT = '.authprint';
const MAX_BYTES = 2_000_000; // generous guard; real flows are a few KB

const THEME_LABELS: Record<Theme, string> = { light: 'Light', dark: 'Dark', system: 'System' };

type Notice = { kind: 'error' | 'info'; title: string; diagnostics: Diagnostic[] };

export function Editor({ initialFlow, examples }: { initialFlow: Flow; examples: ExampleFlow[] }) {
  // ReactFlowProvider hoists the store above the canvas so the palette (a
  // sibling of the canvas) can drive it — e.g. the "Fit view" command.
  return (
    <ReactFlowProvider>
      <EditorShell initialFlow={initialFlow} examples={examples} />
    </ReactFlowProvider>
  );
}

function EditorShell({ initialFlow, examples }: { initialFlow: Flow; examples: ExampleFlow[] }) {
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

  // Parse a source string and swap the flow on success; on a parse failure the
  // current flow stays on screen and the errors surface in the toast.
  const applySource = useCallback((source: string, label: string) => {
    const { flow: parsed, diagnostics } = flowFromSource(source);
    if (!parsed) {
      setNotice({ kind: 'error', title: `Couldn’t parse ${label}`, diagnostics });
      return;
    }
    setDoc(hydrate(parsed));
    setRevision((r) => r + 1);
    setNotice(
      diagnostics.length
        ? {
            kind: 'info',
            title: `Loaded ${label} with ${diagnostics.length} issue(s)`,
            diagnostics,
          }
        : null,
    );
  }, []);

  const loadFile = useCallback(
    async (file: File) => {
      if (!file.name.endsWith(FILE_EXT)) {
        setNotice({
          kind: 'error',
          title: `${file.name} isn’t a ${FILE_EXT} file`,
          diagnostics: [],
        });
        return;
      }
      if (file.size > MAX_BYTES) {
        setNotice({ kind: 'error', title: `${file.name} is too large to load`, diagnostics: [] });
        return;
      }
      applySource(await file.text(), file.name);
    },
    [applySource],
  );

  const openFilePicker = useCallback(() => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = FILE_EXT;
    input.addEventListener('change', () => {
      const file = input.files?.[0];
      if (file) loadFile(file);
    });
    input.click();
  }, [loadFile]);

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

  const commands = useMemo<PaletteCommand[]>(
    () => [
      {
        id: 'open-file',
        group: 'File',
        label: 'Open .authprint file…',
        keywords: 'load import',
        run: openFilePicker,
      },
      ...examples.map((example) => ({
        id: `example-${example.id}`,
        group: 'Examples',
        label: `Open example: ${example.name}`,
        keywords: example.id,
        run: () => applySource(example.source, example.name),
      })),
      {
        id: 'fit-view',
        group: 'View',
        label: 'Fit flow to screen',
        keywords: 'zoom center reset',
        run: () => fitView(FIT_VIEW_OPTIONS),
      },
      ...(['light', 'dark', 'system'] as const).map((option) => ({
        id: `theme-${option}`,
        group: 'Appearance',
        label: `Theme: ${THEME_LABELS[option]}${theme === option ? '  ✓' : ''}`,
        keywords: `dark light system appearance ${option}`,
        run: () => setTheme(option),
      })),
    ],
    [examples, openFilePicker, applySource, fitView, theme, setTheme],
  );

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    const file = files.find((f) => f.name.endsWith(FILE_EXT)) ?? files[0];
    if (file) loadFile(file);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a file drop zone has no semantic role; the palette's "Open file" command is the keyboard-accessible equivalent.
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
        aria-label="Open command palette"
        className="absolute top-4 left-4 z-10 flex items-center gap-2 rounded-md border border-zinc-300 bg-white/80 py-1.5 pr-2 pl-3 text-sm text-zinc-600 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-300 dark:hover:bg-zinc-900"
      >
        Search & commands
        <kbd className="rounded border border-zinc-300 bg-zinc-100 px-1.5 py-0.5 font-mono text-[11px] text-zinc-500 dark:border-zinc-700 dark:bg-zinc-800 dark:text-zinc-400">
          ⌘K
        </kbd>
      </button>

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-indigo-500/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-indigo-400 border-dashed bg-white/90 px-8 py-6 font-medium text-indigo-700 dark:bg-zinc-900/90 dark:text-indigo-300">
            Drop a {FILE_EXT} file to load it
          </div>
        </div>
      )}

      {notice && <NoticeToast notice={notice} onDismiss={() => setNotice(null)} />}

      <CommandPalette open={paletteOpen} onOpenChange={setPaletteOpen} commands={commands} />
    </div>
  );
}

function NoticeToast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
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
          aria-label="Dismiss"
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

// A structural fingerprint of a flow — node identities/types and edge wiring.
// elkjs only needs to re-run when this changes; a drag (which mutates only the
// layout map, not structure) must NOT trigger a re-layout, or the dragged node
// would snap back to its auto-placed spot.
function structureSignature(flow: Flow): string {
  const nodes = flow.nodes
    .map((n) => `${n.id}:${n.type}`)
    .sort()
    .join(',');
  const edges = flow.edges
    .map((e) => `${e.source}>${e.target}`)
    .sort()
    .join(',');
  return `${nodes}|${edges}`;
}

// elkjs auto-layout, recomputed only on structural change. Returns null while a
// (re)layout is in flight so the caller can hold the canvas until coordinates
// are ready — we never paint a graph against stale or empty positions.
function useElkLayout(flow: Flow): NodePositionsMap | null {
  // Layout depends on structure only; a drag changes flow identity but not the
  // signature, so elkjs must not re-run (it would yank the dragged node back to
  // its auto spot). Read the latest flow off a ref so the effect body stays
  // dependency-free beyond the signature.
  const signature = structureSignature(flow);
  const flowRef = useRef(flow);
  // Keep the ref current without touching it during render. The layout effect
  // reads it (not a dep) so it sees the latest flow when the signature changes.
  useEffect(() => {
    flowRef.current = flow;
  }, [flow]);
  const [computed, setComputed] = useState<{
    signature: string;
    positions: NodePositionsMap;
  } | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutFlow(flowRef.current).then((positions) => {
      if (!cancelled) setComputed({ signature, positions });
    });
    return () => {
      cancelled = true;
    };
  }, [signature]);

  // Null while a (re)layout for the current structure is in flight, so the
  // caller holds the canvas rather than painting against stale coordinates.
  return computed?.signature === signature ? computed.positions : null;
}

function FlowCanvas({ doc }: { doc: Y.Doc }) {
  const { flow, layout, onNodesChange: nodesToDoc, onEdgesChange: edgesToDoc } = useYDocFlow(doc);
  const autoPositions = useElkLayout(flow);

  // Dragged nodes (in the layout map) win over auto-placed coordinates.
  const graph = useMemo(
    () => (autoPositions ? flowToReactFlow(flow, { ...autoPositions, ...layout }) : null),
    [flow, layout, autoPositions],
  );

  if (!graph) return null;

  return <BoundCanvas graph={graph} nodesToDoc={nodesToDoc} edgesToDoc={edgesToDoc} />;
}

// Mounted only once coordinates are ready, so its local node/edge state seeds
// with the full graph and `fitView` fits real bounds on the first frame. Holds
// React Flow's interactive state locally (smooth drag) while mirroring every
// change into the Y.Doc; external Y.Doc changes flow back via the `graph` prop.
function BoundCanvas({
  graph,
  nodesToDoc,
  edgesToDoc,
}: {
  graph: ReturnType<typeof flowToReactFlow>;
  nodesToDoc: OnNodesChange<RfNode<CanvasNodeData>>;
  edgesToDoc: OnEdgesChange;
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
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      // Edge *creation* UX is E26; E24 binds move + delete only.
      nodesConnectable={false}
      deleteKeyCode={['Delete', 'Backspace']}
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
