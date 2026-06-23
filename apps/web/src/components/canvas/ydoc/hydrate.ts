// Hydrate a parsed Flow into a Y.Doc (load direction) and read it back out
// (render direction). E24's hydration source is the in-memory `Flow` object the
// Editor already holds — NOT file/Firestore JSON; that boundary (and the layout
// sidecar) is E25's. The `layout` map is left empty on hydrate: a "fresh"
// canvas auto-places via elkjs and persists nothing; only a drag writes a
// position (hybrid-C, §7).

import type { Annotation, Flow, Scenario } from '@authprint/dsl';
import type * as Y from 'yjs';
import {
  buildContextSlotMap,
  buildEdgeMap,
  buildNodeMap,
  contextMap,
  createDoc,
  edgesMap,
  LOCAL_ORIGIN,
  metaMap,
  nodesMap,
  readContext,
  readEdgeMap,
  readNodeMap,
} from './schema.ts';

export function hydrate(flow: Flow): Y.Doc {
  const doc = createDoc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set('id', flow.id);
    meta.set('name', flow.name);
    if (flow.description !== undefined) meta.set('description', flow.description);
    meta.set('theme', flow.theme);
    // Not canvas-edited yet — carried opaquely so a hydrate→read cycle is
    // lossless. E25 gives these a granular home if/when they become editable.
    meta.set('annotations', flow.annotations);
    meta.set('scenarios', flow.scenarios);

    const nodes = nodesMap(doc);
    for (const node of flow.nodes) nodes.set(node.id, buildNodeMap(node));

    const edges = edgesMap(doc);
    for (const edge of flow.edges) edges.set(edge.id, buildEdgeMap(edge));

    const context = contextMap(doc);
    for (const [name, slot] of Object.entries(flow.context)) {
      context.set(name, buildContextSlotMap(slot));
    }
  }, LOCAL_ORIGIN);
  return doc;
}

export function readFlow(doc: Y.Doc): Flow {
  const meta = metaMap(doc);
  const description = meta.get('description') as string | undefined;

  return {
    id: meta.get('id') as string,
    name: meta.get('name') as string,
    ...(description === undefined ? {} : { description }),
    theme: meta.get('theme') as Flow['theme'],
    context: readContext(doc),
    nodes: [...nodesMap(doc).values()].map(readNodeMap),
    edges: [...edgesMap(doc).values()].map(readEdgeMap),
    annotations: (meta.get('annotations') as Annotation[] | undefined) ?? [],
    scenarios: (meta.get('scenarios') as Scenario[] | undefined) ?? [],
  };
}
