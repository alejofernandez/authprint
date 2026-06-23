// The canonical-artifact boundary (E25): Y.Doc ⇄ the persisted/exported shape.
//
// A flow leaves the runtime as `{ flow, layout }` — `flow` is the semantic DSL
// (`@authprint/dsl`, layout-free per Principle 2), `layout` the node positions.
// Serializing those to a bundled `.authprint` (and parsing back) is US-044/045/
// 046; this module is the in-memory transform both directions build on. The
// inverse — hydrating `{ flow, layout }` into a Y.Doc — is `hydrate(flow,
// layout)` in ./hydrate.ts.

import type { Flow } from '@authprint/dsl';
import { stringify } from 'yaml';
import type * as Y from 'yjs';
import { readFlow } from './hydrate.ts';
import { type LayoutPositions, layoutMap } from './schema.ts';

export type FlowArtifact = { flow: Flow; layout: LayoutPositions };

/** Snapshot the live Y.Doc into its persistable parts. `layout` holds only the
 *  manually-positioned nodes; auto-placed nodes are absent (hybrid-C, §7). */
export function docToArtifact(doc: Y.Doc): FlowArtifact {
  return {
    flow: readFlow(doc),
    layout: Object.fromEntries(layoutMap(doc).entries()),
  };
}

// ─── Layout codec ────────────────────────────────────────────────────────────
// YAML for a flat `nodeId: { x, y }` map. Used as the bundled `.authprint`'s
// top-level `layout:` block (US-045) and, later, a standalone `.authprint.layout`
// sidecar (E32) — same codec. Positions are rounded to integer pixels so float
// jitter from drags never churns diffs; keys are sorted for byte-stable output.

export function serializeLayout(layout: LayoutPositions): string {
  const normalized: Record<string, { x: number; y: number }> = {};
  const entries = Object.entries(layout).sort(([a], [b]) => (a < b ? -1 : a > b ? 1 : 0));
  for (const [id, { x, y }] of entries) {
    normalized[id] = { x: Math.round(x), y: Math.round(y) };
  }
  return stringify(normalized);
}

/** Validate an already-parsed `layout` value (the loader extracts it from the
 *  bundled YAML document) into positions. Malformed entries are dropped, never
 *  thrown — a bad layout block degrades to auto-layout, it never blocks a load. */
export function parseLayout(value: unknown): LayoutPositions {
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
      out[id] = { x: Math.round(x), y: Math.round(y) };
    }
  }
  return out;
}
