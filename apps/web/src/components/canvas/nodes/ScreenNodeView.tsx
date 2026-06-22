// Screen node — user-facing step. Visual: rounded rectangle with an indigo
// tint and left accent bar. Handles: target on top, source on bottom and
// right (latter for branching screens with multiple user actions, post-E26).

import type { ScreenNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { NodeShellContent } from './NodeShell.tsx';
import type { CanvasNodeData } from './shared.ts';

type ScreenNodeProps = NodeProps & { data: CanvasNodeData<ScreenNode> };

export function ScreenNodeView({ data }: ScreenNodeProps) {
  const { node } = data;
  return (
    <div className="rounded-lg bg-indigo-50 dark:bg-indigo-950/40 border border-indigo-300 dark:border-indigo-800 border-l-4 border-l-indigo-500 dark:border-l-indigo-400">
      <Handle type="target" position={Position.Top} />
      <NodeShellContent typeLabel="Screen" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Bottom} id="default" />
      <Handle type="source" position={Position.Right} id="alt" />
    </div>
  );
}
