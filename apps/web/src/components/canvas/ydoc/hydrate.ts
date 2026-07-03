// Hydrate a parsed Flow into a Y.Doc (load direction) and read it back out
// (render direction). E24's hydration source is the in-memory `Flow` object the
// Editor already holds. E25 adds the optional `layout` argument: a bundled
// `.authprint` carries saved positions, which seed the `layout` map here. With
// no layout (a fresh/semantic-only flow), the map stays empty and elkjs
// auto-places everything (hybrid-C layout policy).

import type { Annotation, Flow, Scenario } from '@authprint/dsl';
import type * as Y from 'yjs';
import {
  buildContextSlotMap,
  buildEdgeMap,
  buildNodeMap,
  contextMap,
  createDoc,
  type EdgeRoutes,
  edgeLayoutMap,
  edgesMap,
  type LayoutPositions,
  LOCAL_ORIGIN,
  layoutMap,
  metaMap,
  nodesMap,
  readContext,
  readEdgeMap,
  readNodeMap,
} from './schema.ts';

export function hydrate(flow: Flow, layout?: LayoutPositions, edgeLayout?: EdgeRoutes): Y.Doc {
  const doc = createDoc();
  doc.transact(() => {
    const meta = metaMap(doc);
    meta.set('id', flow.id);
    meta.set('name', flow.name);
    if (flow.description !== undefined) meta.set('description', flow.description);
    meta.set('branding', flow.branding);
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

    if (layout) {
      // Seed only positions whose node exists — a stale entry (e.g. from a
      // layout block that drifted from the flow) is dropped, keeping the map
      // consistent with the node set.
      const nodeIds = new Set(flow.nodes.map((n) => n.id));
      const positions = layoutMap(doc);
      for (const [id, position] of Object.entries(layout)) {
        if (nodeIds.has(id)) positions.set(id, position);
      }
    }

    if (edgeLayout) {
      const edgeIds = new Set(flow.edges.map((e) => e.id));
      const routes = edgeLayoutMap(doc);
      for (const [id, points] of Object.entries(edgeLayout)) {
        if (edgeIds.has(id)) routes.set(id, points);
      }
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
    branding: meta.get('branding') as Flow['branding'],
    context: readContext(doc),
    nodes: [...nodesMap(doc).values()].map(readNodeMap),
    edges: [...edgesMap(doc).values()].map(readEdgeMap),
    annotations: (meta.get('annotations') as Annotation[] | undefined) ?? [],
    scenarios: (meta.get('scenarios') as Scenario[] | undefined) ?? [],
  };
}
