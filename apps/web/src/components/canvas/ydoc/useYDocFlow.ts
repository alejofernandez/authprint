// The bidirectional binding between React Flow and the Y.Doc (§7).
//
//   Y.Doc → canvas:  observeDeep recomputes the derived Flow + positions, so any
//                    mutation (local op or, later, a remote sync update) re-renders.
//   canvas → Y.Doc:  React Flow's change events translate to doc transactions —
//                    a finished drag writes the position; a delete removes the
//                    node/edge (incident edges cascade).
//
// Positions are committed on drag *end* only (not every mousemove) so a drag is
// one layout write, not hundreds. The observer only reads — it never writes — so
// our own LOCAL_ORIGIN mutations can't feed back into a loop.

import type { Flow } from '@authprint/dsl';
import type { EdgeChange, NodeChange } from '@xyflow/react';
import { useCallback, useRef, useSyncExternalStore } from 'react';
import type * as Y from 'yjs';
import { readFlow } from './hydrate.ts';
import { moveNode, removeEdge, removeNode } from './ops.ts';
import { contextMap, edgesMap, layoutMap, metaMap, nodesMap, type Position } from './schema.ts';

export type LayoutPositions = Record<string, Position>;

export type YDocFlowSnapshot = { flow: Flow; layout: LayoutPositions };

function snapshot(doc: Y.Doc): YDocFlowSnapshot {
  return { flow: readFlow(doc), layout: Object.fromEntries(layoutMap(doc).entries()) };
}

// ─── Pure change appliers (canvas → Y.Doc) ───────────────────────────────────
// Exported for headless testing; the hook wires them to React Flow.

export function applyNodeChangesToDoc(doc: Y.Doc, changes: NodeChange[]): void {
  for (const change of changes) {
    if (change.type === 'position' && change.dragging === false && change.position) {
      moveNode(doc, change.id, change.position);
    } else if (change.type === 'remove') {
      removeNode(doc, change.id);
    }
  }
}

export function applyEdgeChangesToDoc(doc: Y.Doc, changes: EdgeChange[]): void {
  for (const change of changes) {
    if (change.type === 'remove') removeEdge(doc, change.id);
  }
}

// ─── Hook ────────────────────────────────────────────────────────────────────
//
// The Y.Doc is an external store, so this is `useSyncExternalStore`, not a
// setState-in-effect: `subscribe` registers the observers; `getSnapshot` returns
// the current derived view. The snapshot is memoized and only recomputed after a
// real mutation, so `getSnapshot` returns a stable reference between changes
// (required — a fresh object every call would loop).

export function useYDocFlow(doc: Y.Doc) {
  const cache = useRef<{ doc: Y.Doc; snapshot: YDocFlowSnapshot } | null>(null);

  const subscribe = useCallback(
    (onChange: () => void) => {
      const maps = [nodesMap(doc), edgesMap(doc), contextMap(doc), layoutMap(doc), metaMap(doc)];
      const onMutation = () => {
        cache.current = null; // invalidate; getSnapshot recomputes on next read
        onChange();
      };
      for (const map of maps) map.observeDeep(onMutation);
      return () => {
        for (const map of maps) map.unobserveDeep(onMutation);
      };
    },
    [doc],
  );

  const getSnapshot = useCallback(() => {
    if (cache.current?.doc !== doc) cache.current = { doc, snapshot: snapshot(doc) };
    return cache.current.snapshot;
  }, [doc]);

  const state = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  const onNodesChange = useCallback(
    (changes: NodeChange[]) => applyNodeChangesToDoc(doc, changes),
    [doc],
  );
  const onEdgesChange = useCallback(
    (changes: EdgeChange[]) => applyEdgeChangesToDoc(doc, changes),
    [doc],
  );

  return { flow: state.flow, layout: state.layout, onNodesChange, onEdgesChange };
}
