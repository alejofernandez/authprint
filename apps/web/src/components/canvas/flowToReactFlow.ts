// Map @authprint/dsl Flow → React Flow's { nodes, edges }.
//
// Pure function; the seed of the read-only renderer that E18 will generalize
// to handle layout-layer integration. For US-028, positions are passed in
// from a caller-provided positions map (hardcoded for the sample flow). E17
// will replace that with elkjs auto-layout output.

import type { Flow } from '@authprint/dsl';
import type { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import type { CanvasNodeData } from './nodes/index.ts';

export type NodePositionsMap = Record<string, { x: number; y: number }>;

export type FlowToReactFlowResult = {
  nodes: RfNode<CanvasNodeData>[];
  edges: RfEdge[];
};

export function flowToReactFlow(flow: Flow, positions: NodePositionsMap): FlowToReactFlowResult {
  const nodes: RfNode<CanvasNodeData>[] = flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: positions[node.id] ?? { x: 0, y: 0 },
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
