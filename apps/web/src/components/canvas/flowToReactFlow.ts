// Map @authprint/dsl Flow → React Flow's { nodes, edges }.
//
// Pure function; the seed of the read-only renderer that E18 generalizes to
// handle layout-layer integration. Positions are passed in from a caller —
// elkjs auto-layout (E17) or, later, a layout sidecar.

import type { Diagnostic, Node as DslNode, Flow, Trigger } from '@authprint/dsl';
import { defaultScreenSourceSideForAction } from '@authprint/dsl';
import { MarkerType, type Edge as RfEdge, type Node as RfNode } from '@xyflow/react';
import type { Theme } from '@/components/theme';
import { effectiveSourceHandle, effectiveTargetHandle } from './connectionSides.ts';
import type { CanvasNodeData } from './nodes/index.ts';
import { buildNodeAriaLabel } from './nodes/nodeAriaLabel.ts';
import { resolveScreenTheme } from './nodes/screen/screenTheme.ts';
import type { TraceAttachment } from './scenario/scenarioTrace.ts';
import { type EdgeRoutes, edgeLayoutPoints, type LayoutPositions } from './ydoc/schema.ts';

export type NodePositionsMap = Record<string, { x: number; y: number }>;

/** Per-element validation diagnostics (E33), keyed by node / edge id. */
export type ValidationMaps = {
  byNode: Map<string, Diagnostic[]>;
  byEdge: Map<string, Diagnostic[]>;
};

// Stroke color for an edge with diagnostics (red error / amber warning).
const EDGE_STROKE = { error: '#ef4444', warning: '#f59e0b' } as const;
const TRACE_EDGE_STROKE = { active: '#6366f1', diverged: '#ef4444' } as const;

function edgeStroke(diagnostics: Diagnostic[] | undefined): string | null {
  if (!diagnostics || diagnostics.length === 0) return null;
  return diagnostics.some((d) => d.severity === 'error') ? EDGE_STROKE.error : EDGE_STROKE.warning;
}

function edgeTraceStroke(traceState: 'active' | 'diverged' | undefined): string | null {
  if (traceState === 'diverged') return TRACE_EDGE_STROKE.diverged;
  if (traceState === 'active') return TRACE_EDGE_STROKE.active;
  return null;
}

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
      return defaultScreenSourceSideForAction(trigger.action) === 'bottom' ? 'alt' : 'default';
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
export function labelFor(trigger: Trigger): string | undefined {
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
  edgeRoutes: EdgeRoutes = {},
  validation?: ValidationMaps,
  editorTheme: Theme | 'light' | 'dark' = 'light',
  trace?: TraceAttachment,
  nodeLayout: LayoutPositions = {},
): FlowToReactFlowResult {
  // Physical handle ids with an outgoing edge (respects US-113 side overrides).
  const connectedHandles = new Map<string, Set<string>>();
  for (const edge of flow.edges) {
    const sourceNode = flow.nodes.find((n) => n.id === edge.source);
    const layout = edgeRoutes[edge.id];
    const handle = sourceNode
      ? (effectiveSourceHandle(sourceNode.type, edge.trigger, layout) ?? '')
      : (sourceHandleFor(edge.trigger) ?? '');
    let set = connectedHandles.get(edge.source);
    if (!set) {
      set = new Set();
      connectedHandles.set(edge.source, set);
    }
    set.add(handle);
  }

  // Yes/no branch slots used (semantic — independent of exit side). Decision nodes only.
  const usedDecisionBranches = new Map<string, Set<'yes' | 'no'>>();
  for (const edge of flow.edges) {
    if (edge.trigger.type !== 'branch') continue;
    let set = usedDecisionBranches.get(edge.source);
    if (!set) {
      set = new Set();
      usedDecisionBranches.set(edge.source, set);
    }
    set.add(edge.trigger.value ? 'yes' : 'no');
  }

  const nodes: RfNode<CanvasNodeData>[] = flow.nodes.map((node) => ({
    id: node.id,
    type: node.type,
    position: positions[node.id] ?? { x: 0, y: 0 },
    initialWidth: nodeSize(node).width,
    initialHeight: nodeSize(node).height,
    data: {
      node,
      ariaLabel: buildNodeAriaLabel(flow, node.id),
      connectedHandles: connectedHandles.get(node.id),
      ...(node.type === 'decision' && {
        usedDecisionBranches: usedDecisionBranches.get(node.id),
      }),
      diagnostics: validation?.byNode.get(node.id),
      ...(node.type === 'screen' && {
        screenTheme: resolveScreenTheme(flow.branding.theme, editorTheme),
        branding: flow.branding,
        displayErrorState: nodeLayout[node.id]?.displayErrorState === true,
      }),
      ...(trace && {
        traceState: trace.byNode.get(node.id),
        traceTooltip: trace.tooltips.get(node.id),
      }),
    },
  }));

  const edges: RfEdge[] = flow.edges.map((edge) => {
    const traceStroke = edgeTraceStroke(trace?.byEdge.get(edge.id));
    const validationStroke = edgeStroke(validation?.byEdge.get(edge.id));
    const stroke = traceStroke ?? validationStroke;
    const layout = edgeRoutes[edge.id];
    const waypoints = edgeLayoutPoints(layout);
    const sourceNode = flow.nodes.find((n) => n.id === edge.source);
    const targetNode = flow.nodes.find((n) => n.id === edge.target);
    return {
      id: edge.id,
      source: edge.source,
      target: edge.target,
      sourceHandle: sourceNode
        ? effectiveSourceHandle(sourceNode.type, edge.trigger, layout)
        : sourceHandleFor(edge.trigger),
      targetHandle: targetNode ? effectiveTargetHandle(targetNode.type, layout) : undefined,
      label: labelFor(edge.trigger),
      type: 'routable',
      data: { waypoints },
      reconnectable: true,
      ...(stroke && {
        style: { stroke, strokeWidth: traceStroke ? 3 : 2 },
        markerEnd: { type: MarkerType.ArrowClosed, width: 18, height: 18, color: stroke },
      }),
    };
  });

  return { nodes, edges };
}
