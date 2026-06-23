// Auto-layout via elkjs. Pure async function: Flow → NodePositionsMap.
//
// Uses ELK's `layered` algorithm with `direction: 'RIGHT'` for the LR
// reading we committed to in §7. Per-structural-type intrinsic size hints
// keep the diamond / circle / pill shapes from getting squeezed.
//
// E17 ships only the auto-layout half of hybrid-C; the drag-flips-to-manual
// + Re-tidy behavior arrives in Phase VI (E26+) once editing exists.

import type { Flow } from '@authprint/dsl';
import ELK from 'elkjs/lib/elk.bundled.js';
import { NODE_SIZE, type NodePositionsMap, sourceHandleFor } from './flowToReactFlow.ts';

const elk = new ELK();

// Which side of the node an outgoing handle sits on — must match the handle
// positions on the node components: forward / yes / success exit the right
// (EAST), while no / error / cancel exit the bottom (SOUTH). Feeding these to
// ELK as fixed-side ports makes the layout port-aware: branches separate
// top/bottom and an edge leaving the bottom is never forced to route back up.
function portSide(handle: string): 'EAST' | 'SOUTH' {
  switch (handle) {
    case 'false':
    case 'alt':
    case 'on-error':
      return 'SOUTH';
    default:
      return 'EAST';
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
export async function layoutFlow(flow: Flow): Promise<NodePositionsMap> {
  if (flow.nodes.length === 0) return {};

  // Each distinct outgoing handle on a node becomes one fixed-side port.
  const sourcePorts = new Map<string, Map<string, 'EAST' | 'SOUTH'>>();
  for (const edge of flow.edges) {
    const handle = sourceHandleFor(edge.trigger) ?? FALLBACK_HANDLE;
    const sides = sourcePorts.get(edge.source) ?? new Map<string, 'EAST' | 'SOUTH'>();
    sides.set(handle, portSide(handle));
    sourcePorts.set(edge.source, sides);
  }

  const elkGraph = {
    id: 'root',
    layoutOptions: LAYOUT_OPTIONS,
    children: flow.nodes.map((node) => {
      const outgoing = sourcePorts.get(node.id);
      return {
        id: node.id,
        width: NODE_SIZE[node.type].width,
        height: NODE_SIZE[node.type].height,
        ports: [
          { id: `${node.id}::in`, layoutOptions: { 'elk.port.side': 'WEST' } },
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
      const handle = sourceHandleFor(edge.trigger) ?? FALLBACK_HANDLE;
      return {
        id: edge.id,
        sources: [`${edge.source}::${handle}`],
        targets: [`${edge.target}::in`],
        // Auth flows are a spine (entry → … → success) with branches dropping
        // off it. Prioritising the straightness of the forward (EAST) edges
        // keeps that spine horizontal; the SOUTH branches are free to bend down.
        ...(portSide(handle) === 'EAST'
          ? { layoutOptions: { 'elk.layered.priority.straightness': '10' } }
          : {}),
      };
    }),
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
