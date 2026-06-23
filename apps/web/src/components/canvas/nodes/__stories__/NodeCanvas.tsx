import '@xyflow/react/dist/style.css';

import type { Node as DslNode } from '@authprint/dsl';
import { ReactFlow, ReactFlowProvider, type Node as RfNode } from '@xyflow/react';
import { nodeTypes } from '../index.ts';

export type NodeCanvasProps = {
  /** Structural type — selects the React Flow node component to render. */
  type: keyof typeof nodeTypes;
  /** The DSL node passed through as the component's `data.node`. */
  node: DslNode;
  /** Editor theme to render under (drives Tailwind's `.dark` variant). */
  theme?: 'light' | 'dark';
};

// Renders one structural node on a minimal, non-interactive React Flow canvas at
// a fixed position and zoom = 1, so the same node always lands on the same
// pixels — the prerequisite for stable screenshot baselines. React Flow context
// is mandatory because every node component mounts `<Handle>`s.
export function NodeCanvas({ type, node, theme = 'light' }: NodeCanvasProps) {
  const nodes: RfNode[] = [
    {
      id: node.id,
      type,
      position: { x: 56, y: 52 },
      data: { node },
      draggable: false,
      selectable: false,
      connectable: false,
    },
  ];

  return (
    <div
      data-testid="node-canvas"
      className={`${theme === 'dark' ? 'dark ' : ''}bg-zinc-50 dark:bg-zinc-950`}
      style={{ width: 360, height: 240 }}
    >
      <ReactFlowProvider>
        <ReactFlow
          nodes={nodes}
          edges={[]}
          nodeTypes={nodeTypes}
          defaultViewport={{ x: 0, y: 0, zoom: 1 }}
          nodesDraggable={false}
          nodesConnectable={false}
          elementsSelectable={false}
          panOnDrag={false}
          panOnScroll={false}
          zoomOnScroll={false}
          zoomOnPinch={false}
          zoomOnDoubleClick={false}
          preventScrolling={false}
          proOptions={{ hideAttribution: true }}
        />
      </ReactFlowProvider>
    </div>
  );
}
