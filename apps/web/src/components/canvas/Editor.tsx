'use client';

// The Editor: thin shell wrapping React Flow. v0 renders a hardcoded sample
// flow exercising all six structural node types. E17 will swap hand-tuned
// positions for elkjs auto-layout; E18 will swap the sample flow for one
// loaded from disk; E24+ adds editing via Y.Doc.

import '@xyflow/react/dist/style.css';

import { Background, Controls, MiniMap, ReactFlow } from '@xyflow/react';
import { useMemo } from 'react';
import { flowToReactFlow } from './flowToReactFlow.ts';
import { nodeTypes } from './nodes/index.ts';
import { sampleFlow, samplePositions } from './sampleFlow.ts';

const edgeTypes = {};

export function Editor() {
  const { nodes, edges } = useMemo(() => flowToReactFlow(sampleFlow, samplePositions), []);

  return (
    <div className="h-dvh w-full bg-zinc-50 dark:bg-zinc-950">
      <ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} edgeTypes={edgeTypes} fitView>
        <Background gap={24} size={1} />
        <Controls position="bottom-left" showInteractive={false} />
        <MiniMap position="bottom-right" pannable zoomable />
      </ReactFlow>
    </div>
  );
}
