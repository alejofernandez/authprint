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

import type { Node as DslNode, Edge } from '@authprint/dsl';
import type * as Y from 'yjs';
import {
  buildEdgeMap,
  buildNodeMap,
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

/** Remove a node and cascade-delete its incident edges + layout entry. Idempotent. */
export function removeNode(doc: Y.Doc, nodeId: string): OpResult {
  doc.transact(() => {
    nodesMap(doc).delete(nodeId);
    layoutMap(doc).delete(nodeId);
    for (const edgeId of incidentEdgeIds(doc, nodeId)) edgesMap(doc).delete(edgeId);
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
  doc.transact(() => edgesMap(doc).delete(edgeId), LOCAL_ORIGIN);
  return ok;
}
