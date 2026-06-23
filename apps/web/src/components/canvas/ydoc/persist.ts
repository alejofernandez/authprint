// The canonical-artifact boundary (E25): Y.Doc ⇄ the persisted/exported shape.
//
// A flow leaves the runtime as `{ flow, layout }` — `flow` is the semantic DSL
// (`@authprint/dsl`, layout-free per Principle 2), `layout` the node positions.
// Serializing those to a bundled `.authprint` (and parsing back) is US-044/045/
// 046; this module is the in-memory transform both directions build on. The
// inverse — hydrating `{ flow, layout }` into a Y.Doc — is `hydrate(flow,
// layout)` in ./hydrate.ts.

import type { Flow } from '@authprint/dsl';
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
