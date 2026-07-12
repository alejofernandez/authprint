// Outcome node — terminal state. Visual: pill shape, emerald tint (cool —
// success-leaning by default; the kind drives specific visual variants in a
// later epic). LR layout: target on Left, no source handles (terminal).

import type { OutcomeNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { GEO_TARGET_BOTTOM, GEO_TARGET_TOP } from '../connectionSides.ts';
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
      title={canvasNodeTitle(data.diagnostics)}
      className={`rounded-full bg-node-outcome-bg border border-node-outcome-border ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <Handle type="target" position={Position.Top} id={GEO_TARGET_TOP} />
      <Handle type="target" position={Position.Bottom} id={GEO_TARGET_BOTTOM} />
      <div className="px-4 py-2 min-w-44 text-center">
        <div className="text-[10px] uppercase tracking-wider font-medium text-node-outcome-fg">
          Outcome
        </div>
        <div className="mt-0.5 text-sm font-medium text-fg-default truncate">
          {node.name ?? node.kind}
        </div>
      </div>
    </CanvasNodeRoot>
  );
}
