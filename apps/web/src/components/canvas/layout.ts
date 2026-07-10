// Auto-layout via elkjs. Pure async function: Flow → NodePositionsMap.
//
// Uses ELK's `layered` algorithm with `direction: 'RIGHT'` for the LR
// reading the product committed to. Per-structural-type intrinsic size hints
// keep the diamond / circle / pill shapes from getting squeezed.
//
// E17 ships only the auto-layout half of hybrid-C; the drag-flips-to-manual
// + Re-tidy behavior arrives in Phase VI (E26+) once editing exists.

import type { Flow } from '@authprint/dsl';
import type ELK from 'elkjs/lib/elk.bundled.js';
import { defaultSourceSide, defaultTargetSide, effectiveSourceHandle } from './connectionSides.ts';
import { type NodePositionsMap, nodeSize, sourceHandleFor } from './flowToReactFlow.ts';
import type { ConnectionSide, EdgeRoutes } from './ydoc/schema.ts';

let elkInstance: InstanceType<typeof ELK> | null = null;

async function getElk() {
  if (!elkInstance) {
    if (typeof window === 'undefined') {
      delete (globalThis as { self?: unknown }).self;
    }
    const { default: ELKConstructor } = await import('elkjs/lib/elk.bundled.js');
    elkInstance = new ELKConstructor();
  }
  return elkInstance;
}

// Which side of the node an outgoing handle sits on — must match the handle
// positions on the node components: forward / yes / success exit the right
// (EAST), while no / error / cancel exit the bottom (SOUTH). US-113 adds top
// exits (NORTH) and top/bottom targets on Outcome/External.
function sourcePortSide(side: ConnectionSide): 'EAST' | 'SOUTH' | 'NORTH' {
  switch (side) {
    case 'top':
      return 'NORTH';
    case 'bottom':
      return 'SOUTH';
    default:
      return 'EAST';
  }
}

function targetPortSide(side: ConnectionSide): 'WEST' | 'NORTH' | 'SOUTH' {
  switch (side) {
    case 'top':
      return 'NORTH';
    case 'bottom':
      return 'SOUTH';
    default:
      return 'WEST';
  }
}

// Entry's unconditional edge has no handle id; give it a stable port name.
const FALLBACK_HANDLE = 'out';

const LAYOUT_OPTIONS = {
  'elk.algorithm': 'layered',
  'elk.direction': 'RIGHT',
  'elk.spacing.nodeNode': '40',
  'elk.layered.spacing.nodeNodeBetweenLayers': '80',
  'elk.layered.spacing.edgeNodeBetweenLayers': '40',
  // Auth flows have loops (OTP resend, wrong-code retry, "try another method",
  // OAuth cancel → back). The default greedy cycle-breaker reverses arbitrary
  // edges, which scatters the layering — the entry lands mid-graph and lines
  // cross everywhere. DEPTH_FIRST follows the flow from its sources, so the
  // genuine "go back" edges become the reversed ones: the sequence reads
  // left-to-right and the loops draw as clean back-edges. (Measured on Demo
  // Flow Zero: entry returns to the leftmost layer, ~20 → ~14 crossings.)
  'elk.layered.cycleBreaking.strategy': 'DEPTH_FIRST',
  // Reduce crossings + give edges room.
  'elk.layered.crossingMinimization.strategy': 'LAYER_SWEEP',
  'elk.edgeRouting': 'ORTHOGONAL',
} as const;

// Pin the single Entry to the first layer so the flow always *starts* at the
// left, regardless of how cycle-breaking shakes out for a given graph.
const ENTRY_LAYOUT_OPTIONS = { 'elk.layered.layering.layerConstraint': 'FIRST' } as const;

/**
 * Compute auto-layout positions for every node in `flow`.
 *
 * Returns an empty map for empty flows (avoids unnecessary elkjs calls).
 */
export async function layoutFlow(
  flow: Flow,
  edgeLayout: EdgeRoutes = {},
): Promise<NodePositionsMap> {
  if (flow.nodes.length === 0) return {};

  const nodeById = new Map(flow.nodes.map((n) => [n.id, n]));

  // Each distinct outgoing handle on a node becomes one fixed-side port.
  const sourcePorts = new Map<string, Map<string, 'EAST' | 'SOUTH' | 'NORTH'>>();
  const targetPorts = new Map<string, Map<string, 'WEST' | 'NORTH' | 'SOUTH'>>();

  for (const edge of flow.edges) {
    const sourceNode = nodeById.get(edge.source);
    const layout = edgeLayout[edge.id];

    const sourceHandle = sourceNode
      ? (effectiveSourceHandle(sourceNode.type, edge.trigger, layout) ??
        sourceHandleFor(edge.trigger) ??
        FALLBACK_HANDLE)
      : (sourceHandleFor(edge.trigger) ?? FALLBACK_HANDLE);
    const sourceSide = layout?.sourceSide ?? defaultSourceSide(edge.trigger);
    const sourceSideElk = sourcePortSide(sourceSide);

    const sourcePortMap = sourcePorts.get(edge.source) ?? new Map();
    sourcePortMap.set(sourceHandle, sourceSideElk);
    sourcePorts.set(edge.source, sourcePortMap);

    const targetSide = layout?.targetSide ?? defaultTargetSide();
    const targetPortId =
      targetSide === 'left' ? 'in' : targetSide === 'top' ? 'in-top' : 'in-bottom';
    const targetPortMap = targetPorts.get(edge.target) ?? new Map();
    targetPortMap.set(targetPortId, targetPortSide(targetSide));
    targetPorts.set(edge.target, targetPortMap);
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: flow.nodes.map((node) => {
      const outgoing = sourcePorts.get(node.id);
      const incoming = targetPorts.get(node.id);
      return {
        id: node.id,
        width: nodeSize(node).width,
        height: nodeSize(node).height,
        ports: [
          ...(incoming
            ? [...incoming].map(([portId, side]) => ({
                id: `${node.id}::${portId}`,
                layoutOptions: { 'elk.port.side': side },
              }))
            : [{ id: `${node.id}::in`, layoutOptions: { 'elk.port.side': 'WEST' } }]),
          ...(outgoing
            ? [...outgoing].map(([handle, side]) => ({
                id: `${node.id}::${handle}`,
                layoutOptions: { 'elk.port.side': side },
              }))
            : []),
        ],
        layoutOptions: {
          'elk.portConstraints': 'FIXED_SIDE',
          ...(node.type === 'entry' ? ENTRY_LAYOUT_OPTIONS : {}),
        },
      };
    }),
    edges: flow.edges.map((edge) => {
      const sourceNode = nodeById.get(edge.source);
      const layout = edgeLayout[edge.id];
      const handle = sourceNode
        ? (effectiveSourceHandle(sourceNode.type, edge.trigger, layout) ??
          sourceHandleFor(edge.trigger) ??
          FALLBACK_HANDLE)
        : (sourceHandleFor(edge.trigger) ?? FALLBACK_HANDLE);
      const sourceSide = layout?.sourceSide ?? defaultSourceSide(edge.trigger);
      const targetSide = layout?.targetSide ?? defaultTargetSide();
      const targetPortId =
        targetSide === 'left' ? 'in' : targetSide === 'top' ? 'in-top' : 'in-bottom';
      return {
        id: edge.id,
        sources: [`${edge.source}::${handle}`],
        targets: [`${edge.target}::${targetPortId}`],
        ...(sourcePortSide(sourceSide) === 'EAST'
          ? { layoutOptions: { 'elk.layered.priority.straightness': '10' } }
          : {}),
      };
    }),
  };

  const laid = await (await getElk()).layout(elkGraph);

  const positions: NodePositionsMap = {};
  for (const child of laid.children ?? []) {
    if (child.id && typeof child.x === 'number' && typeof child.y === 'number') {
      positions[child.id] = { x: child.x, y: child.y };
    }
  }
  return positions;
}
