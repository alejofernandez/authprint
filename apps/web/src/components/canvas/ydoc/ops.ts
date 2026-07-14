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

import type {
  Branding,
  ContextSlot,
  Node as DslNode,
  Edge,
  Field,
  FlowTheme,
  Predicate,
  Scenario,
  Trigger,
} from '@authprint/dsl';
import * as Y from 'yjs';
import {
  defaultSourceSide,
  effectiveSourceSide,
  layoutSideForScreenInteraction,
  normalizeSideOverride,
} from '../connectionSides.ts';
import type { ConnectionSide } from './schema.ts';
import {
  buildContextSlotMap,
  buildEdgeMap,
  buildFieldMap,
  buildNodeMap,
  buildPredicateMap,
  buildTriggerMap,
  contextMap,
  type EdgeLayoutRecord,
  edgeLayoutHasData,
  edgeLayoutMap,
  edgesMap,
  LOCAL_ORIGIN,
  layoutMap,
  metaMap,
  type NodeLayoutRecord,
  nodesMap,
  type Position,
  readScenarioOrder,
  readTriggerMap,
  SCENARIO_ORDER_KEY,
  scenariosMap,
  writeScenarioRecord,
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
  doc.transact(() => {
    const map = layoutMap(doc);
    const prev = map.get(nodeId);
    const next: NodeLayoutRecord = { ...position };
    if (prev?.displayErrorState) next.displayErrorState = true;
    map.set(nodeId, next);
  }, LOCAL_ORIGIN);
  return ok;
}

/** Toggle error-banner preview on a screen (layout view state, not DSL). */
export function setScreenDisplayErrorState(
  doc: Y.Doc,
  nodeId: string,
  displayErrorState: boolean,
  position: Position,
): OpResult {
  const node = nodesMap(doc).get(nodeId);
  if (!node) return fail(`node '${nodeId}' does not exist`);
  if (node.get('type') !== 'screen') return fail(`node '${nodeId}' is not a screen`);
  doc.transact(() => {
    const map = layoutMap(doc);
    const prev = map.get(nodeId);
    const x = prev?.x ?? position.x;
    const y = prev?.y ?? position.y;
    if (displayErrorState) map.set(nodeId, { x, y, displayErrorState: true });
    else map.set(nodeId, { x, y });
  }, LOCAL_ORIGIN);
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
  doc.transact(() => {
    const routes = edgeLayoutMap(doc);
    const existing = routes.get(edgeId) ?? {};
    const next: EdgeLayoutRecord = { ...existing, points: [...points] };
    if (!edgeLayoutHasData(next)) routes.delete(edgeId);
    else routes.set(edgeId, next);
  }, LOCAL_ORIGIN);
  return ok;
}

function writeEdgeLayoutRecord(doc: Y.Doc, edgeId: string, record: EdgeLayoutRecord): void {
  const routes = edgeLayoutMap(doc);
  if (!edgeLayoutHasData(record)) routes.delete(edgeId);
  else routes.set(edgeId, record);
}

/** Record per-edge connection-side overrides (layout layer). */
export function setEdgeSideOverrides(
  doc: Y.Doc,
  edgeId: string,
  overrides: { sourceSide?: ConnectionSide; targetSide?: ConnectionSide },
): OpResult {
  if (!edgesMap(doc).has(edgeId)) return fail(`edge '${edgeId}' does not exist`);
  doc.transact(() => {
    const existing = edgeLayoutMap(doc).get(edgeId) ?? {};
    const next: EdgeLayoutRecord = { ...existing };
    if (overrides.sourceSide === undefined) delete next.sourceSide;
    else next.sourceSide = overrides.sourceSide;
    if (overrides.targetSide === undefined) delete next.targetSide;
    else next.targetSide = overrides.targetSide;
    writeEdgeLayoutRecord(doc, edgeId, next);
  }, LOCAL_ORIGIN);
  return ok;
}

export type ReconnectEdgeArgs = {
  edgeId: string;
  source: string;
  target: string;
  sourceHandle?: string | null;
  targetHandle?: string | null;
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
};

/** Apply a React Flow edge reconnect — retarget and/or side override in one undo step. */
export function reconnectEdgeEnd(doc: Y.Doc, args: ReconnectEdgeArgs): OpResult {
  const edgeMap = edgesMap(doc).get(args.edgeId);
  if (!edgeMap) return fail(`edge '${args.edgeId}' does not exist`);
  const nodes = nodesMap(doc);
  if (!nodes.has(args.source)) return fail(`edge source '${args.source}' does not exist`);
  if (!nodes.has(args.target)) return fail(`edge target '${args.target}' does not exist`);

  doc.transact(() => {
    edgeMap.set('source', args.source);
    edgeMap.set('target', args.target);
    const existing = edgeLayoutMap(doc).get(args.edgeId) ?? {};
    const next: EdgeLayoutRecord = { ...existing };
    if (args.sourceSide === undefined) delete next.sourceSide;
    else next.sourceSide = args.sourceSide;
    if (args.targetSide === undefined) delete next.targetSide;
    else next.targetSide = args.targetSide;
    writeEdgeLayoutRecord(doc, args.edgeId, next);
  }, LOCAL_ORIGIN);
  return ok;
}

/** Replace an edge's trigger (one LOCAL_ORIGIN transaction = one undo step). */
export function setEdgeTrigger(doc: Y.Doc, edgeId: string, trigger: Trigger): OpResult {
  const edgeMap = edgesMap(doc).get(edgeId);
  if (!edgeMap) return fail(`edge '${edgeId}' does not exist`);
  doc.transact(() => {
    const existing = edgeLayoutMap(doc).get(edgeId) ?? {};
    const priorTrigger = readTriggerMap(edgeMap.get('trigger') as Y.Map<unknown>);
    edgeMap.set('trigger', buildTriggerMap(trigger));
    if (trigger.type !== 'interaction') return;
    const sourceId = edgeMap.get('source') as string;
    const sourceNode = nodesMap(doc).get(sourceId);
    if (sourceNode?.get('type') !== 'screen') return;

    const currentSide =
      priorTrigger.type === 'interaction'
        ? effectiveSourceSide('screen', priorTrigger, existing)
        : undefined;
    const nextSide = layoutSideForScreenInteraction(trigger.action, currentSide);
    const next: EdgeLayoutRecord = { ...existing };
    if (nextSide === undefined) delete next.sourceSide;
    else next.sourceSide = nextSide;
    writeEdgeLayoutRecord(doc, edgeId, next);
  }, LOCAL_ORIGIN);
  return ok;
}

/** Atomically exchange triggers on two edges (one undo step). */
export function swapEdgeTriggers(doc: Y.Doc, edgeIdA: string, edgeIdB: string): OpResult {
  const mapA = edgesMap(doc).get(edgeIdA);
  const mapB = edgesMap(doc).get(edgeIdB);
  if (!mapA) return fail(`edge '${edgeIdA}' does not exist`);
  if (!mapB) return fail(`edge '${edgeIdB}' does not exist`);

  const sourceId = mapA.get('source') as string;
  const sourceNode = nodesMap(doc).get(sourceId);
  const nodeType = sourceNode?.get('type') as DslNode['type'] | undefined;

  const triggerA = readTriggerMap(mapA.get('trigger') as Y.Map<unknown>);
  const triggerB = readTriggerMap(mapB.get('trigger') as Y.Map<unknown>);
  const layoutA = edgeLayoutMap(doc).get(edgeIdA);
  const layoutB = edgeLayoutMap(doc).get(edgeIdB);

  const preserveSides =
    nodeType !== undefined && shouldPreserveSourceSideOnSwap(nodeType, triggerA, triggerB);
  const sideBeforeA =
    preserveSides && nodeType ? effectiveSourceSide(nodeType, triggerA, layoutA) : undefined;
  const sideBeforeB =
    preserveSides && nodeType ? effectiveSourceSide(nodeType, triggerB, layoutB) : undefined;

  doc.transact(() => {
    mapA.set('trigger', buildTriggerMap(triggerB));
    mapB.set('trigger', buildTriggerMap(triggerA));

    if (preserveSides && nodeType && sideBeforeA !== undefined && sideBeforeB !== undefined) {
      applyPreservedSourceSide(doc, edgeIdA, triggerB, sideBeforeA);
      applyPreservedSourceSide(doc, edgeIdB, triggerA, sideBeforeB);
    }
  }, LOCAL_ORIGIN);
  return ok;
}

function shouldPreserveSourceSideOnSwap(
  nodeType: DslNode['type'],
  triggerA: Trigger,
  triggerB: Trigger,
): boolean {
  if (nodeType === 'decision') {
    return triggerA.type === 'branch' && triggerB.type === 'branch';
  }
  if (nodeType === 'action' || nodeType === 'external') {
    const types = new Set([triggerA.type, triggerB.type]);
    return types.has('on-success') && types.has('on-error');
  }
  return false;
}

function applyPreservedSourceSide(
  doc: Y.Doc,
  edgeId: string,
  newTrigger: Trigger,
  desiredSide: ConnectionSide,
): void {
  const existing = edgeLayoutMap(doc).get(edgeId) ?? {};
  const next: EdgeLayoutRecord = { ...existing };
  const override = normalizeSideOverride(desiredSide, defaultSourceSide(newTrigger));
  if (override === undefined) delete next.sourceSide;
  else next.sourceSide = override;
  writeEdgeLayoutRecord(doc, edgeId, next);
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

export function setNodeErrorMessage(
  doc: Y.Doc,
  id: string,
  errorMessage: string | undefined,
): OpResult {
  const node = nodesMap(doc).get(id);
  if (!node) return fail(`node '${id}' does not exist`);
  const type = node.get('type');
  if (type !== 'action' && type !== 'external') {
    return fail(`node '${id}' is not action/external`);
  }
  const trimmed = errorMessage?.trim();
  doc.transact(() => {
    if (!trimmed) node.delete('errorMessage');
    else node.set('errorMessage', trimmed);
  }, LOCAL_ORIGIN);
  return ok;
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

// ─── Flow-level meta edits (E43 / US-092) ─────────────────────────────────────

export function setFlowName(doc: Y.Doc, name: string): OpResult {
  doc.transact(() => metaMap(doc).set('name', name), LOCAL_ORIGIN);
  return ok;
}

function patchBranding(doc: Y.Doc, patch: Partial<Branding>): void {
  const meta = metaMap(doc);
  const current = (meta.get('branding') as Branding | undefined) ?? { theme: 'light' as const };
  meta.set('branding', { ...current, ...patch });
}

export function setFlowTheme(doc: Y.Doc, theme: FlowTheme): OpResult {
  doc.transact(() => patchBranding(doc, { theme }), LOCAL_ORIGIN);
  return ok;
}

export function setCompanyName(doc: Y.Doc, companyName: string): OpResult {
  doc.transact(() => patchBranding(doc, { companyName }), LOCAL_ORIGIN);
  return ok;
}

export function setPrimaryColor(doc: Y.Doc, primaryColor: string): OpResult {
  doc.transact(() => patchBranding(doc, { primaryColor }), LOCAL_ORIGIN);
  return ok;
}

// ─── Scenario edits (US-116) ─────────────────────────────────────────────────

export function putScenario(doc: Y.Doc, scenario: Scenario): OpResult {
  if (scenario.id.length === 0) return fail('scenario id is required');
  doc.transact(() => {
    const map = scenariosMap(doc);
    const isCreate = !map.has(scenario.id);
    writeScenarioRecord(map, scenario);
    if (isCreate) {
      const order = readScenarioOrder(doc);
      if (!order.includes(scenario.id)) {
        metaMap(doc).set(SCENARIO_ORDER_KEY, [...order, scenario.id]);
      }
    }
  }, LOCAL_ORIGIN);
  return ok;
}

export function removeScenario(doc: Y.Doc, id: string): OpResult {
  if (!scenariosMap(doc).has(id)) return fail(`scenario '${id}' not found`);
  doc.transact(() => {
    scenariosMap(doc).delete(id);
    const order = readScenarioOrder(doc).filter((entry) => entry !== id);
    metaMap(doc).set(SCENARIO_ORDER_KEY, order);
  }, LOCAL_ORIGIN);
  return ok;
}
