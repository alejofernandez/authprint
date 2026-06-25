// Map @authprint/dsl Flow → React Flow's { nodes, edges }.
//
// Pure function; the seed of the read-only renderer that E18 generalizes to
// handle layout-layer integration. Positions are passed in from a caller —
// elkjs auto-layout (E17) or, later, a layout sidecar.

import type { Diagnostic, Node as DslNode, Flow, Trigger } from '@authprint/dsl';
import { MarkerType, type Edge as RfEdge, type Node as RfNode } from '@xyflow/react';
import type { Theme } from '@/components/theme';
import type { CanvasNodeData } from './nodes/index.ts';
import { resolveScreenTheme } from './nodes/screen/screenTheme.ts';

export type NodePositionsMap = Record<string, { x: number; y: number }>;

/** Per-element validation diagnostics (E33), keyed by node / edge id. */
export type ValidationMaps = {
  byNode: Map<string, Diagnostic[]>;
  byEdge: Map<string, Diagnostic[]>;
};

// Stroke color for an edge with diagnostics (red error / amber warning).
const EDGE_STROKE = { error: '#ef4444', warning: '#f59e0b' } as const;
function edgeStroke(diagnostics: Diagnostic[] | undefined): string | null {
  if (!diagnostics || diagnostics.length === 0) return null;
  return diagnostics.some((d) => d.severity === 'error') ? EDGE_STROKE.error : EDGE_STROKE.warning;
}

// Screen interactions that mean "leave / give up" exit the bottom `alt` handle
// (toward the abandoned outcomes) rather than the forward `default` handle.
const RETREAT_ACTIONS = new Set(['cancel', 'back', 'abandon', 'dismiss']);

// Which source handle an edge leaves from. Handle ids match the ones declared
// on each node component, so branches (yes/no), action results (success/error),
// and external failures each leave a distinct, semantically-placed point —
// without this every edge stacks on one handle and you can't tell paths apart.
// Exported so the layout (elkjs ports) can place each edge on the same side the
// handle actually renders on.
export function sourceHandleFor(trigger: Trigger): string | undefined {
  switch (trigger.type) {
    case 'branch':
      return trigger.value ? 'true' : 'false';
    case 'interaction':
      return RETREAT_ACTIONS.has(trigger.action) ? 'alt' : 'default';
    case 'on-success':
      return 'on-success';
    case 'on-error':
    case 'on-denied':
    case 'on-cancelled':
      // External renders a single bottom failure handle. on-error owns it;
      // denied/cancelled edges share it (they keep their own labels) until they
      // get first-class handles via drag-from-handle (US-050).
      return 'on-error';
    default:
      return undefined; // unconditional: entry has a single source handle
  }
}

// Short edge label so the diagram is self-documenting: what action / result
// takes you down each edge (submit, google, yes/no, success/error).
function labelFor(trigger: Trigger): string | undefined {
  switch (trigger.type) {
    case 'interaction':
      return trigger.action;
    case 'branch':
      return trigger.value ? 'yes' : 'no';
    case 'on-success':
      return 'success';
    case 'on-error':
      return 'error';
    case 'on-denied':
      return 'denied';
    case 'on-cancelled':
      return 'cancelled';
    default:
      return undefined;
  }
}

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

// `mockup`-fidelity screens (US-067) render as a full screen card, much larger
// than the labeled box. Size is fidelity-aware so lo-fi / wireframe screens
// keep their tight footprint (US-069 refines the per-tier sizes).
const SCREEN_MOCKUP_SIZE = { width: 256, height: 232 };
const SCREEN_WIREFRAME_SIZE = { width: 256, height: 232 };

export function nodeSize(node: DslNode): { width: number; height: number } {
  if (node.type === 'screen') {
    if (node.fidelity === 'mockup') return SCREEN_MOCKUP_SIZE;
    if (node.fidelity === 'wireframe') return SCREEN_WIREFRAME_SIZE;
  }
  return NODE_SIZE[node.type];
}

export type FlowToReactFlowResult = {
  nodes: RfNode<CanvasNodeData>[];
  edges: RfEdge[];
};

export function flowToReactFlow(
  flow: Flow,
  positions: NodePositionsMap,
  validation?: ValidationMaps,
  editorTheme: Theme | 'light' | 'dark' = 'light',
): FlowToReactFlowResult {
  // Which source handles already carry an edge, per node — drives the per-handle
  // `+` (E26). The unconditional/entry handle has no id, keyed by ''.
  const connectedHandles = new Map<string, Set<string>>();
  for (const edge of flow.edges) {
    const handle = sourceHandleFor(edge.trigger) ?? '';
    let set = connectedHandles.get(edge.source);
    if (!set) {
      set = new Set();
      connectedHandles.set(edge.source, set);
    }
    set.add(handle);
  }

  const nodes: RfNode<CanvasNodeData>[] = flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: positions[node.id] ?? { x: 0, y: 0 },
    initialWidth: nodeSize(node).width,
    initialHeight: nodeSize(node).height,
    data: {
      node,
      connectedHandles: connectedHandles.get(node.id),
      diagnostics: validation?.byNode.get(node.id),
      ...(node.type === 'screen' && {
        screenTheme: resolveScreenTheme(flow.theme, editorTheme),
      }),
    },
  }));

  const edges: RfEdge[] = flow.edges.map((edge) => {
    const stroke = edgeStroke(validation?.byEdge.get(edge.id));
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceHandleFor(edge.trigger),
      label: labelFor(edge.trigger),
      ...(stroke && {
        style: { stroke, strokeWidth: 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
      }),
    };
  });

  return { nodes, edges };
}
