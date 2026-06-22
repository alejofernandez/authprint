'use client';

// The Editor: thin shell wrapping React Flow. v0 renders a hardcoded sample
// flow exercising all six structural node types. E17 computes positions with
// elkjs auto-layout (LR); E18 will swap the sample flow for one loaded from
// disk; E24+ adds editing via Y.Doc.

import '@xyflow/react/dist/style.css';

import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useEffect, useMemo, useState } from 'react';
import { flowToReactFlow, type NodePositionsMap } from './flowToReactFlow.ts';
import { layoutFlow } from './layout.ts';
import { nodeTypes } from './nodes/index.ts';
import { sampleFlow } from './sampleFlow.ts';

const edgeTypes = {};

export function Editor() {
  // Auto-layout runs once on mount. Until it resolves we render nothing inside
  // the canvas shell (no spinner — auth flows are small, layout is sub-frame).
  const [positions, setPositions] = useState<NodePositionsMap | null>(null);

  useEffect(() => {
    let cancelled = false;
    layoutFlow(sampleFlow).then((computed) => {
      if (!cancelled) setPositions(computed);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const graph = useMemo(
    () => (positions ? flowToReactFlow(sampleFlow, positions) : null),
    [positions],
  );

  return (
    <div className="h-dvh w-full bg-zinc-50 dark:bg-zinc-950">
      {graph && (
        <ReactFlow
          nodes={graph.nodes}
          edges={graph.edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          fitView
        >
          <Background gap={24} size={1} />
          <Controls position="bottom-left" showInteractive={false} />
          <MiniMap position="bottom-right" pannable zoomable />
        </ReactFlow>
      )}
    </div>
  );
}
