// External node — hand-off to an external system (Google, OIDC provider,
// etc.). Visual: rectangle with a teal tint (cool, distinct from Action sky)
// + a small outbound arrow indicator on the title to communicate
// "you leave the flow and come back."

import type { ExternalNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { NodeShellContent } from './NodeShell.tsx';
import type { CanvasNodeData } from './shared.ts';

type ExternalNodeProps = NodeProps & { data: CanvasNodeData<ExternalNode> };

export function ExternalNodeView({ data }: ExternalNodeProps) {
  const { node } = data;
  return (
    <div className="relative rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 border-l-4 border-l-teal-500 dark:border-l-teal-400">
      <Handle type="target" position={Position.Top} />
      <div className="absolute top-1.5 right-2 text-teal-600 dark:text-teal-400" aria-hidden>
        ↗
      </div>
      <NodeShellContent typeLabel="External" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Bottom} id="on-success" />
      <Handle type="source" position={Position.Right} id="on-error" />
    </div>
  );
}
