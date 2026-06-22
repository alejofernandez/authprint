// Map @authprint/dsl Flow → React Flow's { nodes, edges }.
//
// Pure function; the seed of the read-only renderer that E18 generalizes to
// handle layout-layer integration. Positions are passed in from a caller —
// elkjs auto-layout (E17) or, later, a layout sidecar.

import type { Node as DslNode, Flow } from '@authprint/dsl';
import type { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import type { CanvasNodeData } from './nodes/index.ts';

export type NodePositionsMap = Record<string, { x: number; y: number }>;

// Per-structural-type intrinsic sizes — eyeballed from the current node
// components. Two consumers share them: elkjs (as layout size hints) and React
// Flow (as `initialWidth`/`initialHeight`, so `fitView` computes correct bounds
// on the first frame instead of waiting for DOM measurement). They don't have
// to be pixel-perfect — React Flow measures the real DOM after mount.
export const NODE_SIZE: Record<DslNode['type'], { width: number; height: number }> = {
  entry: { width: 64, height: 64 },
  screen: { width: 220, height: 84 },
  decision: { width: 180, height: 112 },
  action: { width: 220, height: 68 },
  external: { width: 220, height: 68 },
  outcome: { width: 180, height: 68 },
};

export type FlowToReactFlowResult = {
  nodes: RfNode<CanvasNodeData>[];
  edges: RfEdge[];
};

export function flowToReactFlow(flow: Flow, positions: NodePositionsMap): FlowToReactFlowResult {
  const nodes: RfNode<CanvasNodeData>[] = flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: positions[node.id] ?? { x: 0, y: 0 },
    initialWidth: NODE_SIZE[node.type].width,
    initialHeight: NODE_SIZE[node.type].height,
    data: { node },
  }));

  const edges: RfEdge[] = flow.edges.map((edge) => ({
    id: edge.id,
    source: edge.source,
    target: edge.target,
    label: edge.label,
  }));

  return { nodes, edges };
}
