// Auto-layout via elkjs. Pure async function: Flow → NodePositionsMap.
//
// Uses ELK's `layered` algorithm with `direction: 'RIGHT'` for the LR
// reading we committed to in §7. Per-structural-type intrinsic size hints
// keep the diamond / circle / pill shapes from getting squeezed.
//
// E17 ships only the auto-layout half of hybrid-C; the drag-flips-to-manual
// + Re-tidy behavior arrives in Phase VI (E26+) once editing exists.

import type { Node as DslNode, Flow } from '@authprint/dsl';
import ELK from 'elkjs/lib/elk.bundled.js';
import type { NodePositionsMap } from './flowToReactFlow.ts';

const elk = new ELK();

// Per-structural-type intrinsic sizes — eyeballed from the current node
// components. ELK uses these to pack the layout sensibly; they don't have
// to be pixel-perfect (React Flow measures the real DOM after mount), but
// closer = fewer post-layout shifts.
const NODE_SIZE: Record<DslNode['type'], { width: number; height: number }> = {
  entry: { width: 64, height: 64 },
  screen: { width: 220, height: 84 },
  decision: { width: 180, height: 112 },
  action: { width: 220, height: 68 },
  external: { width: 220, height: 68 },
  outcome: { width: 180, height: 68 },
};

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  // Reduce crossings + give edges room.
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'ORTHOGONAL',
} as const;

/**
 * Compute auto-layout positions for every node in `flow`.
 *
 * Returns an empty map for empty flows (avoids unnecessary elkjs calls).
 */
export async function layoutFlow(flow: Flow): Promise<NodePositionsMap> {
  if (flow.nodes.length === 0) return {};

  const elkGraph = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: flow.nodes.map((node) => ({
      id: node.id,
      width: NODE_SIZE[node.type].width,
      height: NODE_SIZE[node.type].height,
    })),
    edges: flow.edges.map((edge) => ({
      id: edge.id,
      sources: [edge.source],
      targets: [edge.target],
    })),
  };

  const laid = await elk.layout(elkGraph);

  const positions: NodePositionsMap = {};
  for (const child of laid.children ?? []) {
    if (child.id && typeof child.x === 'number' && typeof child.y === 'number') {
      positions[child.id] = { x: child.x, y: child.y };
    }
  }
  return positions;
}
