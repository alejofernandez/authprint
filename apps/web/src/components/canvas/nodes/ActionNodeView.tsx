// Action node — server-side step. Visual: rectangle with a sky-blue tint
// (cool, distinct from Screen indigo). Two source handles for mandatory
// on-success / on-error edges.

import type { ActionNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { NodeShellContent } from './NodeShell.tsx';
import type { CanvasNodeData } from './shared.ts';

type ActionNodeProps = NodeProps & { data: CanvasNodeData<ActionNode> };

export function ActionNodeView({ data }: ActionNodeProps) {
  const { node } = data;
  return (
    <div className="rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 border-l-4 border-l-sky-500 dark:border-l-sky-400">
      <Handle type="target" position={Position.Top} />
      <NodeShellContent typeLabel="Action" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Bottom} id="on-success" />
      <Handle type="source" position={Position.Right} id="on-error" />
    </div>
  );
}
