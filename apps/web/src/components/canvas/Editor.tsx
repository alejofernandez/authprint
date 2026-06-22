'use client';

// The Editor: thin shell wrapping React Flow. Renders a Flow passed in by the
// route (parsed from `.authprint` source). E17 computes positions with elkjs
// auto-layout (LR); E24+ adds editing via Y.Doc — until then the canvas is
// read-only (no node dragging or edge creation).

import '@xyflow/react/dist/style.css';

import type { Flow } from '@authprint/dsl';
import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { flowToReactFlow, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { nodeTypes } from './nodes/index.ts';

const edgeTypes = {};

// Leave margin around the fitted graph. `initialWidth`/`initialHeight` hints on
// the nodes (see flowToReactFlow) give the first fit correct-enough bounds;
// React Flow re-fits against measured sizes once they mount.
const FIT_VIEW_OPTIONS = { padding: 0.15 } as const;

export function Editor({ flow }: { flow: Flow }) {
  // Auto-layout runs whenever the flow changes. We keep the positions paired
  // with the flow they were computed for, so a flow swap yields an empty canvas
  // until its own layout resolves — we never paint a new graph against stale
  // coordinates, and there's no spinner (flows are small, layout is sub-frame).
  const [layout, setLayout] = useState<{ flow: Flow; positions: NodePositionsMap } | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutFlow(flow).then((positions) => {
      if (!cancelled) setLayout({ flow, positions });
    });
    return () => {
      cancelled = true;
    };
  }, [flow]);

  const graph = useMemo(
    () => (layout?.flow === flow ? flowToReactFlow(flow, layout.positions) : null),
    [flow, layout],
  );

  return (
    <div className="h-dvh w-full bg-zinc-50 dark:bg-zinc-950">
      {graph && (
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          nodesDraggable={false}
          nodesConnectable={false}
          fitView
          fitViewOptions={FIT_VIEW_OPTIONS}
          // Default minZoom (0.5) is too high to fit wide flows — a long
          // sequence needs to zoom further out, else fitView clips the ends.
          minZoom={0.1}
        >
          <Background gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable />
        </ReactFlow>
      )}
    </div>
  );
}
