// Node-creation core (E26): the single engine behind both creation affordances
// — the per-handle `+` (US-049) and drag-from-handle (US-050). Given a source
// node + the handle the edge leaves from, it derives the edge trigger (valid by
// construction, §5), makes a placeholder node of the chosen type, and wires the
// two together in one transaction (so E27 can undo a create as a single step).
//
// New nodes are born *incomplete but placed*: a placeholder name + default kind,
// positioned next to the source. The inline card (US-051) / predicate overlay
// (US-052) fill in the real values; validation (E33) flags what's still missing.

import type { Node as DslNode, Edge, Flow, Trigger } from '@authprint/dsl';
import type * as Y from 'yjs';
import { sourceHandleFor } from '../flowToReactFlow.ts';
import {
  buildEdgeMap,
  buildNodeMap,
  edgesMap,
  LOCAL_ORIGIN,
  layoutMap,
  nodesMap,
  type Position,
} from './schema.ts';

// Structural types a user can create. `entry` is excluded — exactly one per flow.
export type CreatableType = Exclude<DslNode['type'], 'entry'>;
export const CREATABLE_TYPES: readonly CreatableType[] = [
  'screen',
  'decision',
  'action',
  'external',
  'outcome',
];

// The edge trigger for an edge leaving `sourceType` from `handleId`. One source
// of truth shared by the `+`, drag-create, and connect paths. Returns null for
// a source/handle that can't originate an edge (e.g. an outcome).
export function triggerFor(sourceType: DslNode['type'], handleId: string | null): Trigger | null {
  switch (sourceType) {
    case 'entry':
      return { type: 'unconditional' };
    case 'screen':
      // default → forward interaction, alt → retreat; label is editable later.
      return { type: 'interaction', action: handleId === 'alt' ? 'back' : 'submit' };
    case 'decision':
      if (handleId === 'true') return { type: 'branch', value: true };
      if (handleId === 'false') return { type: 'branch', value: false };
      return null;
    case 'action':
      if (handleId === 'on-success') return { type: 'on-success' };
      if (handleId === 'on-error') return { type: 'on-error' };
      return null;
    case 'external':
      if (handleId === 'on-success') return { type: 'on-success' };
      if (handleId === 'on-error') return { type: 'on-error' };
      if (handleId === 'on-denied') return { type: 'on-denied' };
      if (handleId === 'on-cancelled') return { type: 'on-cancelled' };
      return null;
    case 'outcome':
      return null;
  }
}

// Placeholder kind for a freshly-created node — honest "not chosen yet" (the
// vocabulary check warns; the inline card sets a real value). Decisions get a
// placeholder predicate slot so the node stays schema-valid (slot is min-1) and
// round-trips; validation flags it as undeclared until the predicate editor
// (US-052) sets a real slot.
const PLACEHOLDER_KIND = 'custom';
const PLACEHOLDER_SLOT = 'choose-slot';

export function defaultNode(type: CreatableType, id: string): DslNode {
  switch (type) {
    case 'screen':
      return {
        type,
        id,
        name: 'New screen',
        kind: PLACEHOLDER_KIND,
        traits: [],
        fields: [],
        fidelity: 'lo-fi',
      };
    case 'decision':
      return {
        type,
        id,
        name: 'New decision',
        kind: PLACEHOLDER_KIND,
        predicate: { slot: PLACEHOLDER_SLOT, op: 'equals', value: true },
      };
    case 'action':
      return { type, id, name: 'New action', kind: PLACEHOLDER_KIND };
    case 'external':
      return { type, id, name: 'New external', kind: PLACEHOLDER_KIND };
    case 'outcome':
      return { type, id, name: 'New outcome', kind: PLACEHOLDER_KIND };
  }
}

const rid = () => crypto.randomUUID().slice(0, 8);

export type CreateConnectedNodeArgs = {
  sourceId: string;
  sourceHandle: string | null;
  type: CreatableType;
  position: Position;
};

/** Create a node of `type` connected to `sourceId` via the handle's trigger.
 *  Returns the new node id, or null if the source/handle can't originate an
 *  edge. One transaction = one undo step (E27). */
export function createConnectedNode(doc: Y.Doc, args: CreateConnectedNodeArgs): string | null {
  const { sourceId, sourceHandle, type, position } = args;
  const source = nodesMap(doc).get(sourceId);
  if (!source) return null;
  const trigger = triggerFor(source.get('type') as DslNode['type'], sourceHandle);
  if (!trigger) return null;

  const nodeId = `${type}-${rid()}`;
  const node = defaultNode(type, nodeId);
  const edge: Edge = { id: `e-${rid()}`, source: sourceId, target: nodeId, trigger };

  doc.transact(() => {
    nodesMap(doc).set(nodeId, buildNodeMap(node));
    edgesMap(doc).set(edge.id, buildEdgeMap(edge));
    layoutMap(doc).set(nodeId, position);
  }, LOCAL_ORIGIN);

  return nodeId;
}

// ─── Connect (drag-from-handle onto an existing node, US-050) ─────────────────

/** Connect `sourceId`→`targetId` with the handle's trigger (no new node).
 *  Returns the new edge id, or null if the source/handle can't originate. */
export function connectNodes(
  doc: Y.Doc,
  args: { sourceId: string; sourceHandle: string | null; targetId: string },
): string | null {
  const { sourceId, sourceHandle, targetId } = args;
  const source = nodesMap(doc).get(sourceId);
  if (!source || !nodesMap(doc).has(targetId)) return null;
  const trigger = triggerFor(source.get('type') as DslNode['type'], sourceHandle);
  if (!trigger) return null;

  const edge: Edge = { id: `e-${rid()}`, source: sourceId, target: targetId, trigger };
  doc.transact(() => edgesMap(doc).set(edge.id, buildEdgeMap(edge)), LOCAL_ORIGIN);
  return edge.id;
}

// Screen interaction handles are open (a screen can have many interactions);
// every other source handle (entry's, decision branches, action/external
// results) takes exactly one edge.
function isSingleUseHandle(sourceType: DslNode['type']): boolean {
  return sourceType !== 'screen';
}

/** Is a proposed connection valid by construction (§5)? Used by React Flow's
 *  `isValidConnection` to reject invalid drags before they land. */
export function validateConnection(
  flow: Flow,
  c: { source?: string | null; target?: string | null; sourceHandle?: string | null },
): boolean {
  const { source, target, sourceHandle } = c;
  if (!source || !target || source === target) return false; // need both ends; no self-loop

  const src = flow.nodes.find((n) => n.id === source);
  const tgt = flow.nodes.find((n) => n.id === target);
  if (!src || !tgt) return false;
  if (tgt.type === 'entry') return false; // entry has no incoming edges
  if (!triggerFor(src.type, sourceHandle ?? null)) return false; // source can't originate here

  if (isSingleUseHandle(src.type)) {
    const handle = sourceHandle ?? '';
    const filled = flow.edges.some(
      (e) => e.source === source && (sourceHandleFor(e.trigger) ?? '') === handle,
    );
    if (filled) return false; // this typed handle already has its edge
  }
  return true;
}
