// Outcome node — terminal state. Visual: pill shape, emerald tint (cool —
// success-leaning by default; the kind drives specific visual variants in a
// later epic). LR layout: target on Left, no source handles (terminal).

import type { OutcomeNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type OutcomeNodeProps = NodeProps & { data: CanvasNodeData<OutcomeNode> };

export function OutcomeNodeView({ data }: OutcomeNodeProps) {
  const { node } = data;
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics, data.traceTooltip)}
      className={`rounded-full bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-400 dark:border-emerald-700 ${canvasNodeRing(data.diagnostics, data.traceState)} ${canvasNodeOpacity(data.traceState)}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <div className="px-4 py-2 min-w-44 text-center">
        <div className="text-[10px] uppercase tracking-wider font-medium text-zinc-500 dark:text-zinc-500">
          Outcome
        </div>
        <div className="mt-0.5 text-sm font-medium text-zinc-900 dark:text-zinc-100 truncate">
          {node.name ?? node.kind}
        </div>
      </div>
    </CanvasNodeRoot>
  );
}
