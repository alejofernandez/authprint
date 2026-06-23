// The canonical-artifact boundary (E25): Y.Doc ⇄ the persisted/exported shape.
//
// A flow leaves the runtime as `{ flow, layout }` — `flow` is the semantic DSL
// (`@authprint/dsl`, layout-free per Principle 2), `layout` the node positions.
// Serializing those to a bundled `.authprint` (and parsing back) is US-044/045/
// 046; this module is the in-memory transform both directions build on. The
// inverse — hydrating `{ flow, layout }` into a Y.Doc — is `hydrate(flow,
// layout)` in ./hydrate.ts.

import { type Flow, serialize } from '@authprint/dsl';
import { stringify, parse as yamlParse } from 'yaml';
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
// top-level `layout:` block and, later, a standalone `.authprint.layout`
// sidecar (E32) — same codec. Positions are rounded to integer pixels so float
// jitter from drags never churns diffs; keys are sorted for byte-stable output.

function normalizeLayout(layout: LayoutPositions): Record<string, { x: number; y: number }> {
  const out: Record<string, { x: number; y: number }> = {};
  for (const [id, { x, y }] of Object.entries(layout).sort(([a], [b]) =>
    a < b ? -1 : a > b ? 1 : 0,
  )) {
    out[id] = { x: Math.round(x), y: Math.round(y) };
  }
  return out;
}

export function serializeLayout(layout: LayoutPositions): string {
  return stringify(normalizeLayout(layout));
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

// ─── Bundle codec ─────────────────────────────────────────────────────────────
// The v0 default save: one `.authprint` carrying the semantic flow at root plus
// an optional top-level `layout:` key (decided 2026-06-23 — single-file UX; see
// REQUIREMENTS §10). The semantic parser treats `layout` as a reserved, ignored
// key, so a bundle still parses as a Flow; `extractLayout` reads the positions
// back. A flow with no manual positions emits a plain semantic file (no
// `layout:` key) — byte-identical to a clean export.

export function serializeBundle({ flow, layout }: FlowArtifact): string {
  const body = serialize(flow);
  if (Object.keys(layout).length === 0) return body;
  const block = stringify({ layout: normalizeLayout(layout) });
  return body.endsWith('\n') ? `${body}${block}` : `${body}\n${block}`;
}

/** Read the bundled `layout:` block from `.authprint` source. Returns an empty
 *  map for a plain semantic file or unparseable input — the flow loads either
 *  way (the semantic parse + its diagnostics are the loader's concern). */
export function extractLayout(source: string): LayoutPositions {
  try {
    const raw = yamlParse(source) as { layout?: unknown } | null;
    return parseLayout(raw?.layout);
  } catch {
    return {};
  }
}
