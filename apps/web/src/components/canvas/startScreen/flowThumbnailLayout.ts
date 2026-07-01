import type { Flow } from '@authprint/dsl';

export type StructuralNodeType =
  | 'entry'
  | 'screen'
  | 'decision'
  | 'action'
  | 'external'
  | 'outcome';

export type NodeShape = 'rect' | 'circle' | 'pill' | 'screen' | 'diamond';

export type ThumbnailNode = {
  id: string;
  type: StructuralNodeType;
  shape: NodeShape;
  x: number;
  y: number;
  w: number;
  h: number;
};

export type ThumbnailEdge = {
  id: string;
  sourceId: string;
  targetId: string;
};

export type FlowThumbnailLayout = {
  viewBox: string;
  nodes: ThumbnailNode[];
  edges: ThumbnailEdge[];
};

const NODE_W = 18;
const NODE_H = 10;
const ENTRY_SIZE = 12;
/** Portrait screen frame for thumbnails: 3×4 */
const SCREEN_W = 15;
const SCREEN_H = Math.round(SCREEN_W * (4 / 3));
/** Decision diamond on canvas: 180×112 */
const DECISION_H = 14;
const DECISION_W = Math.round(DECISION_H * (180 / 112));
const OUTCOME_W = 26;
const OUTCOME_H = 10;
const LAYER_GAP = 32;
const ROW_GAP = 20;
const PADDING = 8;
const VIEW_SIZE = 100;
const MAX_NODES = 14;

function nodeLayout(type: StructuralNodeType): { w: number; h: number; shape: NodeShape } {
  switch (type) {
    case 'entry':
      return { w: ENTRY_SIZE, h: ENTRY_SIZE, shape: 'circle' };
    case 'screen':
      return { w: SCREEN_W, h: SCREEN_H, shape: 'screen' };
    case 'decision':
      return { w: DECISION_W, h: DECISION_H, shape: 'diamond' };
    case 'outcome':
      return { w: OUTCOME_W, h: OUTCOME_H, shape: 'pill' };
    default:
      return { w: NODE_W, h: NODE_H, shape: 'rect' };
  }
}

export function layoutFlowThumbnail(flow: Flow): FlowThumbnailLayout | null {
  if (flow.nodes.length === 0) return null;

  const nodeById = new Map(flow.nodes.map((node) => [node.id, node]));
  const entry = flow.nodes.find((node) => node.type === 'entry');
  const startId = entry?.id ?? flow.nodes[0]?.id;
  if (!startId) return null;

  const layers: string[][] = [];
  const visited = new Set<string>();
  let frontier = [startId];

  while (frontier.length > 0 && visited.size < MAX_NODES) {
    const layer: string[] = [];
    const next = new Set<string>();
    for (const id of frontier) {
      if (visited.has(id) || visited.size >= MAX_NODES) continue;
      visited.add(id);
      layer.push(id);
      for (const edge of flow.edges) {
        if (edge.source === id && nodeById.has(edge.target) && !visited.has(edge.target)) {
          next.add(edge.target);
        }
      }
    }
    if (layer.length > 0) layers.push(layer);
    frontier = [...next];
  }

  for (const node of flow.nodes) {
    if (visited.size >= MAX_NODES) break;
    if (!visited.has(node.id)) {
      layers.push([node.id]);
      visited.add(node.id);
    }
  }

  const rawNodes: ThumbnailNode[] = [];
  let x = PADDING;

  for (const layer of layers) {
    const layerHeights = layer.map((nodeId) => {
      const node = nodeById.get(nodeId);
      return node ? nodeLayout(node.type as StructuralNodeType).h : NODE_H;
    });
    const layerWidths = layer.map((nodeId) => {
      const node = nodeById.get(nodeId);
      return node ? nodeLayout(node.type as StructuralNodeType).w : NODE_W;
    });
    const columnWidth = layerWidths.length > 0 ? Math.max(...layerWidths) : NODE_W;
    const columnHeight =
      layerHeights.reduce((sum, h, i) => sum + h + (i > 0 ? ROW_GAP : 0), 0) || NODE_H;
    const maxColumnHeight = layers.reduce((max, l) => {
      const h = l.reduce((sum, nodeId, i) => {
        const node = nodeById.get(nodeId);
        const nh = node ? nodeLayout(node.type as StructuralNodeType).h : NODE_H;
        return sum + nh + (i > 0 ? ROW_GAP : 0);
      }, 0);
      return Math.max(max, h);
    }, NODE_H);
    const yOffset = PADDING + (maxColumnHeight - columnHeight) / 2;
    let y = yOffset;
    for (const nodeId of layer) {
      const node = nodeById.get(nodeId);
      if (!node) continue;
      const layout = nodeLayout(node.type as StructuralNodeType);
      rawNodes.push({
        id: nodeId,
        type: node.type as StructuralNodeType,
        shape: layout.shape,
        x,
        y,
        w: layout.w,
        h: layout.h,
      });
      y += layout.h + ROW_GAP;
    }
    x += columnWidth + LAYER_GAP;
  }

  const placed = new Set(rawNodes.map((node) => node.id));
  const edges: ThumbnailEdge[] = [];
  for (const edge of flow.edges) {
    if (placed.has(edge.source) && placed.has(edge.target)) {
      edges.push({ id: edge.id, sourceId: edge.source, targetId: edge.target });
    }
  }

  return fitThumbnailLayout(rawNodes, edges);
}

function fitThumbnailLayout(nodes: ThumbnailNode[], edges: ThumbnailEdge[]): FlowThumbnailLayout {
  if (nodes.length === 0) {
    return { viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`, nodes: [], edges: [] };
  }

  const minX = Math.min(...nodes.map((node) => node.x));
  const minY = Math.min(...nodes.map((node) => node.y));
  const maxX = Math.max(...nodes.map((node) => node.x + node.w));
  const maxY = Math.max(...nodes.map((node) => node.y + node.h));
  const contentW = Math.max(maxX - minX, 1);
  const contentH = Math.max(maxY - minY, 1);
  const inner = VIEW_SIZE - PADDING * 2;
  const scale = Math.min(inner / contentW, inner / contentH);
  const scaledW = contentW * scale;
  const scaledH = contentH * scale;
  const xOffset = PADDING + (inner - scaledW) / 2;
  const yOffset = PADDING + (inner - scaledH) / 2;

  const scaledNodes = nodes.map((node) => ({
    ...node,
    x: xOffset + (node.x - minX) * scale,
    y: yOffset + (node.y - minY) * scale,
    w: node.w * scale,
    h: node.h * scale,
  }));

  return {
    viewBox: `0 0 ${VIEW_SIZE} ${VIEW_SIZE}`,
    nodes: scaledNodes,
    edges,
  };
}

export function edgeLine(
  layout: FlowThumbnailLayout,
  edge: ThumbnailEdge,
): { x1: number; y1: number; x2: number; y2: number } | null {
  const source = layout.nodes.find((node) => node.id === edge.sourceId);
  const target = layout.nodes.find((node) => node.id === edge.targetId);
  if (!source || !target) return null;
  const sourceY = source.y + source.h / 2;
  const targetY = target.y + target.h / 2;
  return {
    x1: source.x + source.w,
    y1: sourceY,
    x2: target.x,
    y2: targetY,
  };
}
