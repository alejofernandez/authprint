// The Y.Doc runtime model for an editable flow (E24).
//
// The Y.Doc is the canvas's in-memory working memory; single-user editing is
// "Yjs with one client", and a sync transport (v2) drops in without a model
// refactor. It is NOT the persisted form — on save we serialize to DSL +
// layout JSON (E25); Yjs binary blobs are never the canonical artifact.
//
// The document is five top-level Y.Maps — `nodes`, `edges`, `context`,
// `layout`, `edgeLayout` — plus a `meta` map for flow-level scalars (id/name/theme) and, for
// now, the not-yet-canvas-edited `annotations` / `scenarios` carried opaquely
// so a hydrate→read cycle is lossless. Node attributes are modeled as a nested
// Y.Map (traits → Y.Array, fields → Y.Array<Y.Map>, predicate → Y.Map) rather
// than an opaque blob, so field-level CRDT merge works when collab arrives —
// the entire point of Yjs-from-MVP. That costs more thought per edit — an
// accepted trade-off.

import type {
  Context,
  ContextSlot,
  Node as DslNode,
  Edge,
  Field,
  Flow,
  Predicate,
  Trigger,
} from '@authprint/dsl';
import * as Y from 'yjs';

// Origin tag on every local mutation transaction. Lets E27's Y.UndoManager
// scope to local edits and v2 sync tell local from remote — wired now so
// neither needs a later refactor.
export const LOCAL_ORIGIN = Symbol('authprint.local');

// Map names live in one place so getters and tests never drift from strings.
const NODES = 'nodes';
const EDGES = 'edges';
const CONTEXT = 'context';
const LAYOUT = 'layout';
const EDGE_LAYOUT = 'edgeLayout';
const META = 'meta';

export type Position = { x: number; y: number };
/** Node id → canvas position. The `layout` map's plain-object view (E25 artifact). */
export type LayoutPositions = Record<string, Position>;

export type ConnectionSide = 'top' | 'bottom' | 'left' | 'right';

/** Per-edge layout view state: optional waypoints and/or connection-side overrides. */
export type EdgeLayoutRecord = {
  points?: Position[];
  sourceSide?: ConnectionSide;
  targetSide?: ConnectionSide;
};

/** Parsed layout value — legacy waypoint arrays or the object form (US-113). */
export type EdgeLayoutEntry = Position[] | EdgeLayoutRecord;

/** Edge id → layout view state (normalized to EdgeLayoutRecord in the Y.Doc). */
export type EdgeRoutes = Record<string, EdgeLayoutRecord>;

const CONNECTION_SIDES = new Set<ConnectionSide>(['top', 'bottom', 'left', 'right']);

export function isConnectionSide(value: unknown): value is ConnectionSide {
  return typeof value === 'string' && CONNECTION_SIDES.has(value as ConnectionSide);
}

export function normalizeEdgeLayoutEntry(entry: EdgeLayoutEntry | undefined): EdgeLayoutRecord {
  if (!entry) return {};
  if (Array.isArray(entry)) return entry.length > 0 ? { points: [...entry] } : {};
  const record: EdgeLayoutRecord = {};
  if (entry.points && entry.points.length > 0) record.points = [...entry.points];
  if (entry.sourceSide !== undefined) record.sourceSide = entry.sourceSide;
  if (entry.targetSide !== undefined) record.targetSide = entry.targetSide;
  return record;
}

export function edgeLayoutPoints(
  entry: EdgeLayoutRecord | EdgeLayoutEntry | undefined,
): Position[] {
  if (!entry) return [];
  if (Array.isArray(entry)) return entry;
  return entry.points ?? [];
}

export function edgeLayoutHasData(record: EdgeLayoutRecord): boolean {
  return (
    (record.points?.length ?? 0) > 0 ||
    record.sourceSide !== undefined ||
    record.targetSide !== undefined
  );
}

// ─── Top-level accessors ─────────────────────────────────────────────────────

export function createDoc(): Y.Doc {
  const doc = new Y.Doc();
  // Touch each map so it exists on a fresh doc (getMap is create-or-get).
  doc.getMap(NODES);
  doc.getMap(EDGES);
  doc.getMap(CONTEXT);
  doc.getMap(LAYOUT);
  doc.getMap(EDGE_LAYOUT);
  doc.getMap(META);
  return doc;
}

export const nodesMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap(NODES);
export const edgesMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap(EDGES);
export const contextMap = (doc: Y.Doc): Y.Map<Y.Map<unknown>> => doc.getMap(CONTEXT);
export const layoutMap = (doc: Y.Doc): Y.Map<Position> => doc.getMap(LAYOUT);
export const edgeLayoutMap = (doc: Y.Doc): Y.Map<EdgeLayoutRecord> => doc.getMap(EDGE_LAYOUT);
export const metaMap = (doc: Y.Doc): Y.Map<unknown> => doc.getMap(META);

// ─── Node ⇄ Y.Map ────────────────────────────────────────────────────────────

export function buildNodeMap(node: DslNode): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('type', node.type);
  map.set('id', node.id);

  if ('name' in node && node.name !== undefined) map.set('name', node.name);
  if ('kind' in node) map.set('kind', node.kind);

  if (node.type === 'screen') {
    map.set('fidelity', node.fidelity);
    const traits = new Y.Array<string>();
    traits.push([...node.traits]);
    map.set('traits', traits);
    const fields = new Y.Array<Y.Map<unknown>>();
    fields.push(node.fields.map(buildFieldMap));
    map.set('fields', fields);
  }

  if (node.type === 'decision') {
    map.set('predicate', buildPredicateMap(node.predicate));
  }

  return map;
}

export function readNodeMap(map: Y.Map<unknown>): DslNode {
  const type = map.get('type') as DslNode['type'];
  const id = map.get('id') as string;

  switch (type) {
    case 'entry':
      return { type, id };
    case 'screen':
      return {
        type,
        id,
        name: map.get('name') as string,
        kind: map.get('kind') as string,
        traits: (map.get('traits') as Y.Array<string>).toArray(),
        fields: (map.get('fields') as Y.Array<Y.Map<unknown>>).map(readFieldMap),
        fidelity: map.get('fidelity') as 'lo-fi' | 'wireframe' | 'mockup',
      } as DslNode;
    case 'decision':
      return {
        type,
        id,
        name: map.get('name') as string | undefined,
        kind: map.get('kind') as string,
        predicate: readPredicateMap(map.get('predicate') as Y.Map<unknown>),
      };
    default:
      // action | external | outcome — all { type, id, name, kind }
      return {
        type,
        id,
        name: map.get('name') as string,
        kind: map.get('kind') as string,
      };
  }
}

export function buildFieldMap(field: Field): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('name', field.name);
  map.set('type', field.type);
  map.set('required', field.required);
  return map;
}

function readFieldMap(map: Y.Map<unknown>): Field {
  return {
    name: map.get('name') as string,
    type: map.get('type') as string,
    required: map.get('required') as boolean,
  };
}

export function buildPredicateMap(predicate: Predicate): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('slot', predicate.slot);
  map.set('op', predicate.op);
  map.set('value', predicate.value);
  return map;
}

function readPredicateMap(map: Y.Map<unknown>): Predicate {
  return {
    slot: map.get('slot') as string,
    op: map.get('op') as Predicate['op'],
    value: map.get('value'),
  };
}

// ─── Edge ⇄ Y.Map ────────────────────────────────────────────────────────────

export function buildEdgeMap(edge: Edge): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('id', edge.id);
  map.set('source', edge.source);
  map.set('target', edge.target);
  // Trigger is a small discriminated union; store its fields in a nested map
  // and reconstruct the union by `type` on read.
  map.set('trigger', buildTriggerMap(edge.trigger));
  if (edge.label !== undefined) map.set('label', edge.label);
  return map;
}

export function readEdgeMap(map: Y.Map<unknown>): Edge {
  const edge: Edge = {
    id: map.get('id') as string,
    source: map.get('source') as string,
    target: map.get('target') as string,
    trigger: readTriggerMap(map.get('trigger') as Y.Map<unknown>),
  };
  const label = map.get('label') as string | undefined;
  return label === undefined ? edge : { ...edge, label };
}

function buildTriggerMap(trigger: Trigger): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('type', trigger.type);
  if (trigger.type === 'interaction') map.set('action', trigger.action);
  if (trigger.type === 'branch') map.set('value', trigger.value);
  return map;
}

function readTriggerMap(map: Y.Map<unknown>): Trigger {
  const type = map.get('type') as Trigger['type'];
  if (type === 'interaction') return { type, action: map.get('action') as string };
  if (type === 'branch') return { type, value: map.get('value') as boolean };
  return { type };
}

// ─── Context slot ⇄ Y.Map ────────────────────────────────────────────────────

export function buildContextSlotMap(slot: ContextSlot): Y.Map<unknown> {
  const map = new Y.Map<unknown>();
  map.set('type', slot.type);
  if (slot.values !== undefined) map.set('values', [...slot.values]);
  return map;
}

export function readContextSlotMap(map: Y.Map<unknown>): ContextSlot {
  const type = map.get('type') as ContextSlot['type'];
  const values = map.get('values') as string[] | undefined;
  return values === undefined ? { type } : { type, values: [...values] };
}

export function readContext(doc: Y.Doc): Context {
  const context: Context = {};
  for (const [name, slot] of contextMap(doc)) context[name] = readContextSlotMap(slot);
  return context;
}

// ─── Flow-level meta ─────────────────────────────────────────────────────────
// id / name / description are scalars; branding (which now nests `theme`
// alongside companyName/primaryColor — grouped because all three answer "how
// does this flow's screens look"), annotations, and scenarios are carried
// opaquely (plain JSON) until they become canvas-editable — E24 only needs
// them to survive a hydrate→read cycle, not to merge granularly. Branding's
// three fields are independently settable (setFlowTheme / setCompanyName /
// setPrimaryColor in ops.ts) via read-modify-write on the one blob, rather
// than exploding into their own meta keys — it's document metadata, not
// something that needs node-level collab-merge granularity.

export type FlowMeta = Pick<Flow, 'id' | 'name' | 'description' | 'branding'>;
