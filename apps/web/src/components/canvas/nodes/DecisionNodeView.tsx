// Decision node — predicate-evaluated branching. Visual: classic flowchart
// diamond, violet tint. Two source handles on left/right for true/false
// branches; target on top.

import type { DecisionNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import type { CanvasNodeData } from './shared.ts';

type DecisionNodeProps = NodeProps & { data: CanvasNodeData<DecisionNode> };

export function DecisionNodeView({ data }: DecisionNodeProps) {
  const { node } = data;
  return (
    <div className="relative w-44 h-28 flex items-center justify-center">
      {/* Diamond background via clip-path on a rotated square. */}
      <div
        className="absolute inset-0 bg-violet-50 dark:bg-violet-950/40 border border-violet-400 dark:border-violet-700"
        style={{ clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }}
      />
      <div className="relative z-10 px-4 text-center">
        <div className="text-[10px] uppercase tracking-wider font-medium text-violet-700 dark:text-violet-300">
          Decision
        </div>
        <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {node.name ?? node.kind}
        </div>
        <div className="mt-0.5 text-[10px] text-zinc-500 font-mono">{node.id}</div>
      </div>
      <Handle type="target" position={Position.Top} />
      <Handle type="source" position={Position.Left} id="false" />
      <Handle type="source" position={Position.Right} id="true" />
    </div>
  );
}
