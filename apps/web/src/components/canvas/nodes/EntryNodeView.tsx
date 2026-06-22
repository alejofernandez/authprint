// Entry node — flow start. Visual: small circle, neutral cool gray.
// LR layout: single source handle on the right (one outgoing unconditional edge).

import type { EntryNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import type { CanvasNodeData } from './shared.ts';

type EntryNodeProps = NodeProps & { data: CanvasNodeData<EntryNode> };

export function EntryNodeView({ data }: EntryNodeProps) {
  return (
    <div className="relative">
      <div className="h-16 w-16 rounded-full bg-zinc-200 dark:bg-zinc-800 border-2 border-zinc-400 dark:border-zinc-600 flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-zinc-700 dark:text-zinc-300">
          Start
        </div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-zinc-500">
        {data.node.id}
      </div>
      <Handle type="source" position={Position.Right} />
    </div>
  );
}
