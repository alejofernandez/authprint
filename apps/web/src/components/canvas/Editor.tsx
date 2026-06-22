'use client';

// The Editor: thin shell wrapping React Flow. Renders a Flow — initially the
// one the route loaded (Demo Flow Zero), then whatever `.authprint` file the
// user drops or opens (US-032, the seed of file-based v0 persistence). E17
// computes positions with elkjs auto-layout (LR); E24+ adds editing via Y.Doc —
// until then the canvas is read-only (no node dragging or edge creation).

import '@xyflow/react/dist/style.css';

import type { Diagnostic, Flow } from '@authprint/dsl';
import { Background, Controls, MarkerType, MiniMap, ReactFlow } from '@xyflow/react';
import {
  type ChangeEvent,
  type DragEvent,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { flowFromSource } from './flowFromSource.ts';
import { flowToReactFlow, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { nodeTypes } from './nodes/index.ts';

const edgeTypes = {};

// Leave margin around the fitted graph. `initialWidth`/`initialHeight` hints on
// the nodes (see flowToReactFlow) give the first fit correct-enough bounds;
// React Flow re-fits against measured sizes once they mount.
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

type Notice = { kind: 'error' | 'info'; title: string; diagnostics: Diagnostic[] };

export function Editor({ initialFlow }: { initialFlow: Flow }) {
  const [flow, setFlow] = useState(initialFlow);
  // Bumped on every successful load so the canvas remounts and re-runs `fitView`
  // for the new flow (the `fitView` prop only fires on mount).
  const [revision, setRevision] = useState(0);
  const [notice, setNotice] = useState<Notice | null>(null);
  const [dragging, setDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const loadFile = useCallback(async (file: File) => {
    if (!file.name.endsWith(FILE_EXT)) {
      setNotice({ kind: 'error', title: `${file.name} isn’t a ${FILE_EXT} file`, diagnostics: [] });
      return;
    }
    if (file.size > MAX_BYTES) {
      setNotice({ kind: 'error', title: `${file.name} is too large to load`, diagnostics: [] });
      return;
    }
    const { flow: parsed, diagnostics } = flowFromSource(await file.text());
    if (!parsed) {
      // Unparseable — keep the current flow on screen, surface the errors.
      setNotice({ kind: 'error', title: `Couldn’t parse ${file.name}`, diagnostics });
      return;
    }
    setFlow(parsed);
    setRevision((r) => r + 1);
    // A flow can render with validation issues; show them without blocking.
    setNotice(
      diagnostics.length
        ? {
            kind: 'info',
            title: `Loaded ${file.name} with ${diagnostics.length} issue(s)`,
            diagnostics,
          }
        : null,
    );
  }, []);

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    setDragging(false);
    const files = [...event.dataTransfer.files];
    const file = files.find((f) => f.name.endsWith(FILE_EXT)) ?? files[0];
    if (file) loadFile(file);
  };

  const onInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) loadFile(file);
    event.target.value = ''; // allow re-selecting the same file
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: a file drop zone has no semantic role; the "Open" button is the keyboard-accessible equivalent.
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
      <FlowCanvas key={revision} flow={flow} />

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        className="absolute top-4 left-4 z-10 rounded-md border border-zinc-300 bg-white/80 px-3 py-1.5 font-medium text-sm text-zinc-700 shadow-sm backdrop-blur transition-colors hover:bg-white dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200 dark:hover:bg-zinc-900"
      >
        Open {FILE_EXT}
      </button>
      <input ref={inputRef} type="file" accept={FILE_EXT} hidden onChange={onInputChange} />

      {dragging && (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-indigo-500/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-indigo-400 border-dashed bg-white/90 px-8 py-6 font-medium text-indigo-700 dark:bg-zinc-900/90 dark:text-indigo-300">
            Drop a {FILE_EXT} file to load it
          </div>
        </div>
      )}

      {notice && <NoticeToast notice={notice} onDismiss={() => setNotice(null)} />}
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
          className="text-zinc-400 text-sm leading-none hover:text-zinc-600 dark:hover:text-zinc-200"
        >
          ✕
        </button>
      </div>
      {notice.diagnostics.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-xs text-zinc-600 dark:text-zinc-400">
          {notice.diagnostics.map((d, i) => (
            // The parser can emit genuinely identical diagnostics (same
            // code/path/message), and this list is rendered once and never
            // reordered, so the index is the correct stable key.
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

function FlowCanvas({ flow }: { flow: Flow }) {
  // Auto-layout runs whenever the flow changes. We keep the positions paired
  // with the flow they were computed for, so a flow swap yields an empty canvas
  // until its own layout resolves — we never paint a new graph against stale
  // coordinates, and there's no spinner (flows are small, layout is sub-frame).
  const [layout, setLayout] = useState<{ flow: Flow; positions: NodePositionsMap } | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutFlow(flow).then((positions) => {
      if (!cancelled) setLayout({ flow, positions });
    });
    return () => {
      cancelled = true;
    };
  }, [flow]);

  const graph = useMemo(
    () => (layout?.flow === flow ? flowToReactFlow(flow, layout.positions) : null),
    [flow, layout],
  );

  if (!graph) return null;

  return (
    <ReactFlow
      nodes={graph.nodes}
      edges={graph.edges}
      nodeTypes={nodeTypes}
      edgeTypes={edgeTypes}
      nodesDraggable={false}
      nodesConnectable={false}
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
