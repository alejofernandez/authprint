// Primitive mutation API over the Y.Doc. Each op is one transaction tagged
// LOCAL_ORIGIN. These are the vocabulary E26's direct-manipulation UX and E27's
// undo grouping build on, so they stay small, composable, and side-effect-free
// beyond the doc.
//
// Structural *correctness* (reachability, mandatory edges, predicate typing) is
// NOT enforced here — that's `@authprint/dsl` `validate()`, surfaced live on the
// canvas in E33. These ops enforce only the cheap invariants that keep the doc
// internally consistent (no duplicate ids, no edges to nonexistent nodes, no
// dangling edges after a node delete).

import type { ContextSlot, Node as DslNode, Edge, Field, Predicate } from '@authprint/dsl';
import * as Y from 'yjs';
import {
  buildContextSlotMap,
  buildEdgeMap,
  buildFieldMap,
  buildNodeMap,
  buildPredicateMap,
  contextMap,
  edgeLayoutMap,
  edgesMap,
  LOCAL_ORIGIN,
  layoutMap,
  nodesMap,
  type Position,
} from './schema.ts';

export type OpResult = { ok: true } | { ok: false; reason: string };
const ok: OpResult = { ok: true };
const fail = (reason: string): OpResult => ({ ok: false, reason });

/** Edge ids whose source or target is `nodeId`. Shared with the binding's delete path. */
export function incidentEdgeIds(doc: Y.Doc, nodeId: string): string[] {
  const ids: string[] = [];
  for (const [id, edge] of edgesMap(doc)) {
    if (edge.get('source') === nodeId || edge.get('target') === nodeId) ids.push(id);
  }
  return ids;
}

export function addNode(doc: Y.Doc, node: DslNode): OpResult {
  if (nodesMap(doc).has(node.id)) return fail(`node '${node.id}' already exists`);
  doc.transact(() => nodesMap(doc).set(node.id, buildNodeMap(node)), LOCAL_ORIGIN);
  return ok;
}

/** Remove a node and cascade-delete its incident edges, their routes, and layout entry. */
export function removeNode(doc: Y.Doc, nodeId: string): OpResult {
  const edgeIds = incidentEdgeIds(doc, nodeId);
  doc.transact(() => {
    nodesMap(doc).delete(nodeId);
    layoutMap(doc).delete(nodeId);
    for (const edgeId of edgeIds) {
      edgesMap(doc).delete(edgeId);
      edgeLayoutMap(doc).delete(edgeId);
    }
  }, LOCAL_ORIGIN);
  return ok;
}

/** Persist a node position (flips the canvas to manual mode for that node). */
export function moveNode(doc: Y.Doc, nodeId: string, position: Position): OpResult {
  if (!nodesMap(doc).has(nodeId)) return fail(`node '${nodeId}' does not exist`);
  doc.transact(() => layoutMap(doc).set(nodeId, position), LOCAL_ORIGIN);
  return ok;
}

export function addEdge(doc: Y.Doc, edge: Edge): OpResult {
  if (edgesMap(doc).has(edge.id)) return fail(`edge '${edge.id}' already exists`);
  const nodes = nodesMap(doc);
  if (!nodes.has(edge.source)) return fail(`edge source '${edge.source}' does not exist`);
  if (!nodes.has(edge.target)) return fail(`edge target '${edge.target}' does not exist`);
  doc.transact(() => edgesMap(doc).set(edge.id, buildEdgeMap(edge)), LOCAL_ORIGIN);
  return ok;
}

export function removeEdge(doc: Y.Doc, edgeId: string): OpResult {
  doc.transact(() => {
    edgesMap(doc).delete(edgeId);
    edgeLayoutMap(doc).delete(edgeId);
  }, LOCAL_ORIGIN);
  return ok;
}

/** Persist a manual edge route (waypoints). One transaction = one undo step. */
export function setEdgeRoute(doc: Y.Doc, edgeId: string, points: Position[]): OpResult {
  if (!edgesMap(doc).has(edgeId)) return fail(`edge '${edgeId}' does not exist`);
  doc.transact(() => edgeLayoutMap(doc).set(edgeId, points), LOCAL_ORIGIN);
  return ok;
}

// ─── Node attribute edits (E26 inline card, US-051) ──────────────────────────
// Write through to a node's nested Y.Map. Each is one LOCAL_ORIGIN transaction.

function withNode(doc: Y.Doc, id: string, fn: (node: Y.Map<unknown>) => void): OpResult {
  const node = nodesMap(doc).get(id);
  if (!node) return fail(`node '${id}' does not exist`);
  doc.transact(() => fn(node), LOCAL_ORIGIN);
  return ok;
}

export function setNodeName(doc: Y.Doc, id: string, name: string): OpResult {
  return withNode(doc, id, (node) => node.set('name', name));
}

export function setNodeKind(doc: Y.Doc, id: string, kind: string): OpResult {
  return withNode(doc, id, (node) => node.set('kind', kind));
}

export function setScreenFidelity(
  doc: Y.Doc,
  id: string,
  fidelity: 'lo-fi' | 'wireframe' | 'mockup',
): OpResult {
  return withNode(doc, id, (node) => node.set('fidelity', fidelity));
}

// Traits/fields are replaced wholesale (a fresh Y.Array) on each edit — granular
// per-item CRDT merge isn't needed for single-user v1, and replace keeps the
// editor simple. The nested-Y.Array shape is preserved for when it matters.
export function setScreenTraits(doc: Y.Doc, id: string, traits: string[]): OpResult {
  return withNode(doc, id, (node) => {
    const arr = new Y.Array<string>();
    arr.push([...traits]);
    node.set('traits', arr);
  });
}

export function setScreenFields(doc: Y.Doc, id: string, fields: Field[]): OpResult {
  return withNode(doc, id, (node) => {
    const arr = new Y.Array<Y.Map<unknown>>();
    arr.push(fields.map(buildFieldMap));
    node.set('fields', arr);
  });
}

export function setDecisionPredicate(doc: Y.Doc, id: string, predicate: Predicate): OpResult {
  return withNode(doc, id, (node) => node.set('predicate', buildPredicateMap(predicate)));
}

/** Declare (or replace) a Context slot — used by the predicate editor's inline
 *  "new slot" so a Decision is usable on a fresh flow without a separate Context
 *  editor (US-052). */
export function declareContextSlot(doc: Y.Doc, name: string, slot: ContextSlot): OpResult {
  if (name.length === 0) return fail('slot name is required');
  doc.transact(() => contextMap(doc).set(name, buildContextSlotMap(slot)), LOCAL_ORIGIN);
  return ok;
}
