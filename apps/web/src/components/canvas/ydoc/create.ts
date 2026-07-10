// Node-creation core (E26): the single engine behind both creation affordances
// — the per-handle `+` (US-049) and drag-from-handle (US-050). Given a source
// node + the handle the edge leaves from, it derives the edge trigger (valid by
// construction), makes a placeholder node of the chosen type, and wires the
// two together in one transaction (so E27 can undo a create as a single step).
//
// New nodes are born *incomplete but placed*: a placeholder name + default kind,
// positioned next to the source. The inline card (US-051) / predicate overlay
// (US-052) fill in the real values; validation (E33) flags what's still missing.

import type { Node as DslNode, Edge, Flow, Trigger } from '@authprint/dsl';
import type * as Y from 'yjs';
import {
  defaultSourceSide,
  defaultTargetSide,
  GEO_SOURCE_BOTTOM,
  GEO_SOURCE_RIGHT,
  GEO_SOURCE_TOP,
  isGeometricTargetHandle,
  isSideRelocationSourceHandle,
  isSideRelocationTargetHandle,
  normalizeSideOverride,
  screenInteractionAllowedOnHandle,
  sourceSideFromReconnect,
  targetSideFromReconnect,
} from '../connectionSides.ts';
import { reconnectEdgeEnd } from './ops.ts';
import type { ConnectionSide } from './schema.ts';
import {
  buildEdgeMap,
  buildNodeMap,
  type EdgeRoutes,
  edgeLayoutMap,
  edgesMap,
  LOCAL_ORIGIN,
  layoutMap,
  nodesMap,
  type Position,
  readEdgeMap,
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

type CreateFromHandle = { trigger: Trigger; sourceSide?: ConnectionSide };

function branchUsed(edges: Edge[], sourceId: string, value: boolean): boolean {
  return edges.some(
    (e) => e.source === sourceId && e.trigger.type === 'branch' && e.trigger.value === value,
  );
}

function triggersEqual(a: Trigger, b: Trigger): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

/** Resolve a create/`+`/drag-connect action from a source handle.
 *  Single entry point — do not call triggerFor alone for side handles. */
export function resolveCreateFromHandle(
  sourceType: DslNode['type'],
  sourceId: string,
  sourceHandle: string | null,
  edges: Edge[],
): CreateFromHandle | null {
  const direct = triggerFor(sourceType, sourceHandle);
  if (direct) return { trigger: direct };

  if (sourceType !== 'decision') return null;

  const yesOpen = !branchUsed(edges, sourceId, true);
  const noOpen = !branchUsed(edges, sourceId, false);

  switch (sourceHandle) {
    case GEO_SOURCE_TOP:
      if (yesOpen) return { trigger: { type: 'branch', value: true }, sourceSide: 'top' };
      if (noOpen) return { trigger: { type: 'branch', value: false }, sourceSide: 'top' };
      return null;
    case GEO_SOURCE_BOTTOM:
      if (noOpen) return { trigger: { type: 'branch', value: false }, sourceSide: 'bottom' };
      if (yesOpen) return { trigger: { type: 'branch', value: true }, sourceSide: 'bottom' };
      return null;
    case GEO_SOURCE_RIGHT:
      if (yesOpen) return { trigger: { type: 'branch', value: true }, sourceSide: 'right' };
      if (noOpen) return { trigger: { type: 'branch', value: false }, sourceSide: 'right' };
      return null;
    default:
      return null;
  }
}

// Default kind per structural type — a real built-in so new nodes are
// valid-silent (no spurious vocabulary-unknown-*-kind). The inline card still
// lets the author pick a different kind. Decisions get a placeholder predicate
// slot so the node stays schema-valid (slot is min-1) and round-trips;
// validation flags it as undeclared until the predicate editor sets a real slot.
const DEFAULT_KIND: Record<CreatableType, string> = {
  screen: 'identifier-collect',
  decision: 'user-exists',
  action: 'validate-credentials',
  external: 'oauth-provider',
  outcome: 'authenticated',
};
const PLACEHOLDER_SLOT = 'choose-slot';

export function defaultNode(type: CreatableType, id: string): DslNode {
  const kind = DEFAULT_KIND[type];
  switch (type) {
    case 'screen':
      return {
        type,
        id,
        name: 'New screen',
        kind,
        traits: [],
        fields: [],
        fidelity: 'lo-fi',
      };
    case 'decision':
      return {
        type,
        id,
        name: 'New decision',
        kind,
        predicate: { slot: PLACEHOLDER_SLOT, op: 'equals', value: true },
      };
    case 'action':
      return { type, id, name: 'New action', kind };
    case 'external':
      return { type, id, name: 'New external', kind };
    case 'outcome':
      return { type, id, name: 'New outcome', kind };
  }
}

const rid = () => crypto.randomUUID().slice(0, 8);

export type CreateConnectedNodeArgs = {
  sourceId: string;
  sourceHandle: string | null;
  type: CreatableType;
  position: Position;
};

function layoutSideFromResolved(resolved: CreateFromHandle): ConnectionSide | undefined {
  if (!resolved.sourceSide) return undefined;
  return normalizeSideOverride(resolved.sourceSide, defaultSourceSide(resolved.trigger));
}

function writeEdgeWithLayout(doc: Y.Doc, edge: Edge, sourceSide?: ConnectionSide): void {
  edgesMap(doc).set(edge.id, buildEdgeMap(edge));
  if (sourceSide !== undefined) {
    edgeLayoutMap(doc).set(edge.id, { sourceSide });
  }
}

/** Create a node of `type` connected to `sourceId` via the handle's trigger.
 *  Returns the new node id, or null if the source/handle can't originate an
 *  edge. One transaction = one undo step (E27). */
export function createConnectedNode(doc: Y.Doc, args: CreateConnectedNodeArgs): string | null {
  const { sourceId, sourceHandle, type, position } = args;
  const source = nodesMap(doc).get(sourceId);
  if (!source) return null;
  const sourceType = source.get('type') as DslNode['type'];
  const edges = [...edgesMap(doc).values()].map(readEdgeMap);
  const resolved = resolveCreateFromHandle(sourceType, sourceId, sourceHandle, edges);
  if (!resolved) return null;

  const nodeId = `${type}-${rid()}`;
  const node = defaultNode(type, nodeId);
  const edge: Edge = {
    id: `e-${rid()}`,
    source: sourceId,
    target: nodeId,
    trigger: resolved.trigger,
  };
  const sourceSide = layoutSideFromResolved(resolved);

  doc.transact(() => {
    nodesMap(doc).set(nodeId, buildNodeMap(node));
    writeEdgeWithLayout(doc, edge, sourceSide);
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
  const sourceType = source.get('type') as DslNode['type'];
  const edges = [...edgesMap(doc).values()].map(readEdgeMap);
  const resolved = resolveCreateFromHandle(sourceType, sourceId, sourceHandle, edges);
  if (!resolved) return null;

  const edge: Edge = {
    id: `e-${rid()}`,
    source: sourceId,
    target: targetId,
    trigger: resolved.trigger,
  };
  const sourceSide = layoutSideFromResolved(resolved);

  doc.transact(() => writeEdgeWithLayout(doc, edge, sourceSide), LOCAL_ORIGIN);
  return edge.id;
}

// Screen interaction handles are open (a screen can have many interactions);
// every other source handle (entry's, decision branches, action/external
// results) takes exactly one edge.
function isSingleUseHandle(sourceType: DslNode['type']): boolean {
  return sourceType !== 'screen';
}

/** Is a proposed connection valid by construction? Used by React Flow's
 *  `isValidConnection` to reject invalid drags before they land. */
export function validateConnection(
  flow: Flow,
  c: {
    source?: string | null;
    target?: string | null;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
  options?: { reconnectingEdgeId?: string },
): boolean {
  const { source, target, sourceHandle, targetHandle } = c;
  if (!source || !target || source === target) return false;

  const src = flow.nodes.find((n) => n.id === source);
  const tgt = flow.nodes.find((n) => n.id === target);
  if (!src || !tgt) return false;
  if (tgt.type === 'entry') return false;

  const reconnecting = options?.reconnectingEdgeId
    ? flow.edges.find((e) => e.id === options.reconnectingEdgeId)
    : undefined;

  if (reconnecting) {
    if (
      source === reconnecting.source &&
      isSideRelocationSourceHandle(src.type, sourceHandle ?? null)
    ) {
      if (
        src.type === 'screen' &&
        reconnecting.trigger.type === 'interaction' &&
        !screenInteractionAllowedOnHandle(reconnecting.trigger.action, sourceHandle ?? null)
      ) {
        return false;
      }
      return true;
    }
    if (
      target === reconnecting.target &&
      isSideRelocationTargetHandle(tgt.type, targetHandle ?? null)
    ) {
      return true;
    }
  }

  if (isGeometricTargetHandle(tgt.type, targetHandle ?? null)) return false;

  const activeEdges = flow.edges.filter((e) => e.id !== options?.reconnectingEdgeId);
  const resolved = resolveCreateFromHandle(src.type, source, sourceHandle ?? null, activeEdges);
  if (!resolved) return false;

  if (isSingleUseHandle(src.type)) {
    const filled = activeEdges.some(
      (e) => e.source === source && triggersEqual(e.trigger, resolved.trigger),
    );
    if (filled) return false;
  }
  return true;
}

/** Apply a React Flow edge reconnect — retarget and/or record side overrides. */
export function applyEdgeReconnect(
  doc: Y.Doc,
  flow: Flow,
  edgeLayout: EdgeRoutes,
  edgeId: string,
  connection: {
    source: string;
    target: string;
    sourceHandle?: string | null;
    targetHandle?: string | null;
  },
): boolean {
  const edge = flow.edges.find((e) => e.id === edgeId);
  if (!edge) return false;
  const sourceNode = flow.nodes.find((n) => n.id === connection.source);
  const targetNode = flow.nodes.find((n) => n.id === connection.target);
  if (!sourceNode || !targetNode) return false;

  if (
    connection.source === edge.source &&
    sourceNode.type === 'screen' &&
    edge.trigger.type === 'interaction' &&
    !screenInteractionAllowedOnHandle(edge.trigger.action, connection.sourceHandle ?? null)
  ) {
    return false;
  }

  if (connection.source !== edge.source || connection.target !== edge.target) {
    if (!validateConnection(flow, connection, { reconnectingEdgeId: edgeId })) return false;
  }

  const existing = edgeLayout[edgeId];
  let sourceSide = existing?.sourceSide;
  let targetSide = existing?.targetSide;

  if (connection.source === edge.source) {
    const side = sourceSideFromReconnect(sourceNode.type, edge.trigger, connection.sourceHandle);
    if (side !== undefined) {
      sourceSide = normalizeSideOverride(side, defaultSourceSide(edge.trigger));
    }
  } else {
    sourceSide = undefined;
  }

  if (connection.target === edge.target) {
    const side = targetSideFromReconnect(targetNode.type, connection.targetHandle);
    if (side !== undefined) {
      targetSide = normalizeSideOverride(side, defaultTargetSide());
    }
  } else {
    targetSide = undefined;
  }

  const result = reconnectEdgeEnd(doc, {
    edgeId,
    source: connection.source,
    target: connection.target,
    sourceHandle: connection.sourceHandle,
    targetHandle: connection.targetHandle,
    sourceSide,
    targetSide,
  });
  return result.ok;
}
