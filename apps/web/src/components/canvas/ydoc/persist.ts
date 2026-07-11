// The canonical-artifact boundary (E25): Y.Doc ⇄ the persisted/exported shape.
//
// A flow leaves the runtime as `{ flow, layout, edgeLayout? }` — `flow` is the
// semantic DSL (`@authprint/dsl`, layout-free per Principle 2), `layout` the
// node positions, `edgeLayout` optional per-edge waypoints. Serializing those
// to a bundled `.authprint` (and parsing back) is US-044/045/046; this module
// is the in-memory transform both directions build on. The inverse — hydrating
// `{ flow, layout, edgeLayout? }` into a Y.Doc — is `hydrate(flow, layout,
// edgeLayout?)` in ./hydrate.ts.

import { type Flow, serialize } from '@authprint/dsl';
import { stringify, parse as yamlParse } from 'yaml';
import type * as Y from 'yjs';
import { readFlow } from './hydrate.ts';
import {
  type EdgeLayoutEntry,
  type EdgeLayoutRecord,
  type EdgeRoutes,
  edgeLayoutHasData,
  edgeLayoutMap,
  isConnectionSide,
  type LayoutPositions,
  layoutMap,
  type NodeLayoutRecord,
} from './schema.ts';

export type { EdgeLayoutEntry, EdgeLayoutRecord, EdgeRoutes, LayoutPositions };

export type LayoutBlock = { nodes: LayoutPositions; edges: EdgeRoutes };

export type FlowArtifact = { flow: Flow; layout: LayoutPositions; edgeLayout?: EdgeRoutes };

/** Snapshot the live Y.Doc into its persistable parts. `layout` holds only the
 *  manually-positioned nodes; `edgeLayout` holds routes with waypoints. */
export function docToArtifact(doc: Y.Doc): FlowArtifact {
  const layout = Object.fromEntries(layoutMap(doc).entries());
  const edgeRoutes: EdgeRoutes = {};
  for (const [id, record] of edgeLayoutMap(doc).entries()) {
    if (edgeLayoutHasData(record)) edgeRoutes[id] = { ...record };
  }
  return {
    flow: readFlow(doc),
    layout,
    ...(Object.keys(edgeRoutes).length > 0 ? { edgeLayout: edgeRoutes } : {}),
  };
}

// ─── Layout codec ────────────────────────────────────────────────────────────
// Bundled `.authprint` and `.authprint.layout` sidecar use a nested shape:
// `layout: { nodes: { nodeId: { x, y } }, edges: { edgeId: [{ x, y }, …] } }`.
// `parseLayoutBlock` also accepts the legacy flat node map (all values `{x,y}`).

function normalizeLayout(
  layout: LayoutPositions,
): Record<string, { x: number; y: number; displayErrorState?: boolean }> {
  const out: Record<string, { x: number; y: number; displayErrorState?: boolean }> = {};
  for (const [id, record] of Object.entries(layout).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const entry: NodeLayoutRecord = {
      x: Math.round(record.x),
      y: Math.round(record.y),
    };
    if (record.displayErrorState) entry.displayErrorState = true;
    out[id] = entry;
  }
  return out;
}

function parseWaypointList(value: unknown): { x: number; y: number }[] {
  if (!Array.isArray(value)) return [];
  const route: { x: number; y: number }[] = [];
  for (const point of value) {
    if (point === null || typeof point !== 'object') continue;
    const { x, y } = point as Record<string, unknown>;
    if (
      typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y)
    ) {
      route.push({ x: Math.round(x), y: Math.round(y) });
    }
  }
  return route;
}

function parseEdgeLayoutEntry(value: unknown): EdgeLayoutRecord | undefined {
  if (Array.isArray(value)) {
    const points = parseWaypointList(value);
    return points.length > 0 ? { points } : undefined;
  }
  if (value === null || typeof value !== 'object') return undefined;
  const obj = value as Record<string, unknown>;
  const record: EdgeLayoutRecord = {};
  const points = parseWaypointList(obj.points);
  if (points.length > 0) record.points = points;
  if (isConnectionSide(obj.sourceSide)) record.sourceSide = obj.sourceSide;
  if (isConnectionSide(obj.targetSide)) record.targetSide = obj.targetSide;
  return edgeLayoutHasData(record) ? record : undefined;
}

function parseEdgeRoutes(value: unknown): EdgeRoutes {
  const out: EdgeRoutes = {};
  if (value === null || typeof value !== 'object') return out;
  for (const [edgeId, entry] of Object.entries(value as Record<string, unknown>)) {
    const record = parseEdgeLayoutEntry(entry);
    if (record) out[edgeId] = record;
  }
  return out;
}

function serializeEdgeLayoutEntry(record: EdgeLayoutRecord): unknown {
  const hasPoints = (record.points?.length ?? 0) > 0;
  const hasSides = record.sourceSide !== undefined || record.targetSide !== undefined;
  if (!hasPoints && !hasSides) return undefined;
  if (hasPoints && !hasSides) {
    return record.points?.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
  }
  const out: Record<string, unknown> = {};
  if (hasPoints) {
    out.points = record.points?.map(({ x, y }) => ({ x: Math.round(x), y: Math.round(y) }));
  }
  if (record.sourceSide !== undefined) out.sourceSide = record.sourceSide;
  if (record.targetSide !== undefined) out.targetSide = record.targetSide;
  return out;
}

function normalizeEdgeRoutes(routes: EdgeRoutes): Record<string, unknown> {
  const out: Record<string, unknown> = {};
  for (const [id, record] of Object.entries(routes).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    const serialized = serializeEdgeLayoutEntry(record);
    if (serialized !== undefined) out[id] = serialized;
  }
  return out;
}

function parseNodePositions(value: unknown): LayoutPositions {
  const out: LayoutPositions = {};
  if (value === null || typeof value !== 'object') return out;
  for (const [id, pos] of Object.entries(value as Record<string, unknown>)) {
    if (pos === null || typeof pos !== 'object') continue;
    const { x, y } = pos as Record<string, unknown>;
    if (
      typeof x === 'number' &&
      Number.isFinite(x) &&
      typeof y === 'number' &&
      Number.isFinite(y)
    ) {
      const record: NodeLayoutRecord = { x: Math.round(x), y: Math.round(y) };
      const displayErrorState = (pos as Record<string, unknown>).displayErrorState;
      if (displayErrorState === true) record.displayErrorState = true;
      out[id] = record;
    }
  }
  return out;
}

/** Parse a `layout:` block (nested or legacy flat node map) into nodes + edges. */
export function parseLayoutBlock(value: unknown): LayoutBlock {
  if (value === null || typeof value !== 'object') return { nodes: {}, edges: {} };
  const obj = value as Record<string, unknown>;
  if (obj.nodes !== undefined && typeof obj.nodes === 'object' && obj.nodes !== null) {
    return {
      nodes: parseNodePositions(obj.nodes),
      edges: parseEdgeRoutes(obj.edges),
    };
  }
  return { nodes: parseNodePositions(obj), edges: {} };
}

/** Node positions only — backward-compatible wrapper over `parseLayoutBlock`. */
export function parseLayout(value: unknown): LayoutPositions {
  return parseLayoutBlock(value).nodes;
}

export function serializeLayout(layout: LayoutPositions, edgeLayout: EdgeRoutes = {}): string {
  const hasNodes = Object.keys(layout).length > 0;
  const hasEdges = Object.keys(edgeLayout).length > 0;
  if (!hasNodes && !hasEdges) return stringify({});
  const block: Record<string, unknown> = {};
  if (hasNodes) block.nodes = normalizeLayout(layout);
  if (hasEdges) block.edges = normalizeEdgeRoutes(edgeLayout);
  return stringify(block);
}

// ─── Bundle codec ─────────────────────────────────────────────────────────────

function hasLayoutData(layout: LayoutPositions, edgeLayout: EdgeRoutes = {}): boolean {
  return Object.keys(layout).length > 0 || Object.keys(edgeLayout).length > 0;
}

export function serializeBundle({ flow, layout, edgeLayout = {} }: FlowArtifact): string {
  const body = serialize(flow);
  if (!hasLayoutData(layout, edgeLayout)) return body;
  const layoutValue: Record<string, unknown> = {};
  if (Object.keys(layout).length > 0) layoutValue.nodes = normalizeLayout(layout);
  if (Object.keys(edgeLayout).length > 0) layoutValue.edges = normalizeEdgeRoutes(edgeLayout);
  const block = stringify({ layout: layoutValue });
  return body.endsWith('\n') ? `${body}${block}` : `${body}\n${block}`;
}

/** Read the bundled `layout:` block from `.authprint` source. */
export function extractLayoutArtifact(source: string): LayoutBlock {
  try {
    const raw = yamlParse(source) as { layout?: unknown } | null;
    return parseLayoutBlock(raw?.layout);
  } catch {
    return { nodes: {}, edges: {} };
  }
}

/** Node positions from a bundled file (legacy callers). */
export function extractLayout(source: string): LayoutPositions {
  return extractLayoutArtifact(source).nodes;
}

/** Edge routes from a bundled file. */
export function extractEdgeLayout(source: string): EdgeRoutes {
  return extractLayoutArtifact(source).edges;
}

// ─── Export packagings (E32 / US-065) ────────────────────────────────────────

export function serializeSemantic(artifact: FlowArtifact): string {
  return serialize(artifact.flow);
}

export type SidecarExport = { semantic: string; layout: string };

export function serializeSidecar(artifact: FlowArtifact): SidecarExport {
  return {
    semantic: serialize(artifact.flow),
    layout: serializeLayout(artifact.layout, artifact.edgeLayout ?? {}),
  };
}

// ─── Import packaging detection (E32 / US-066) ───────────────────────────────

export const AUTHPRINT_EXT = '.authprint';
export const LAYOUT_SIDECAR_EXT = '.authprint.layout';

export function isAuthprintFile(filename: string): boolean {
  return filename.endsWith(AUTHPRINT_EXT) && !filename.endsWith(LAYOUT_SIDECAR_EXT);
}

export function isLayoutSidecarFile(filename: string): boolean {
  return filename.endsWith(LAYOUT_SIDECAR_EXT);
}

export function authprintBasename(filename: string): string | null {
  if (filename.endsWith(LAYOUT_SIDECAR_EXT)) {
    return filename.slice(0, -LAYOUT_SIDECAR_EXT.length);
  }
  if (isAuthprintFile(filename)) {
    return filename.slice(0, -AUTHPRINT_EXT.length);
  }
  return null;
}

export function findMatchingSidecar(
  authprintFilename: string,
  sidecarFilenames: readonly string[],
): string | undefined {
  const stem = authprintBasename(authprintFilename);
  if (!stem) return undefined;
  return sidecarFilenames.find((name) => authprintBasename(name) === stem);
}

export function parseLayoutSidecar(source: string): LayoutBlock {
  try {
    return parseLayoutBlock(yamlParse(source));
  } catch {
    return { nodes: {}, edges: {} };
  }
}

/** Resolve layout for import: bundled inline `layout:` wins; else sidecar; else empty. */
export function resolveLayoutForImport(
  authprintSource: string,
  sidecarSource?: string,
): LayoutBlock {
  const bundled = extractLayoutArtifact(authprintSource);
  if (hasLayoutData(bundled.nodes, bundled.edges)) return bundled;
  if (sidecarSource !== undefined) return parseLayoutSidecar(sidecarSource);
  return { nodes: {}, edges: {} };
}
