// Outcome node — terminal state. Visual: pill shape, emerald tint (cool —
// success-leaning by default; the kind drives specific visual variants in a
// later epic). LR layout: target on Left, no source handles (terminal).

import type { OutcomeNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { NodeShellContent } from './NodeShell.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type OutcomeNodeProps = NodeProps & { data: CanvasNodeData<OutcomeNode> };

export function OutcomeNodeView({ data }: OutcomeNodeProps) {
  const { node } = data;
  return (
    <div
      className={`rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 ${canvasNodeRing(data.diagnostics, data.traceState)} ${canvasNodeOpacity(data.traceState)}`}
      title={canvasNodeTitle(data.diagnostics, data.traceTooltip)}
    >
      <Handle type="target" position={Position.Left} />
      <NodeShellContent typeLabel="Outcome" name={node.name} id={node.id} kind={node.kind} />
    </div>
  );
}
