// Decision node — predicate-evaluated branching. Visual: classic flowchart
// diamond, violet tint. LR layout uses the diamond's points meaningfully:
// target on Left (incoming), the `true` (yes) branch leaves the Right point so
// the primary path continues straight ahead, and the `false` (no) branch leaves
// the Bottom point so it drops away below — matching the elkjs port sides, so
// edges never have to double back up across the flow.

import type { DecisionNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { HandlePlus } from './HandlePlus.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type DecisionNodeProps = NodeProps & { data: CanvasNodeData<DecisionNode> };

export function DecisionNodeView({ data, selected }: DecisionNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics, data.traceTooltip)}
      className={`group relative w-44 h-28 flex items-center justify-center ${canvasNodeRing(data.diagnostics, data.traceState)} ${canvasNodeOpacity(data.traceState)}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
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
      </div>
      <Handle type="target" position={Position.Left} />
      <Handle type="source" position={Position.Right} id="true" />
      <Handle type="source" position={Position.Bottom} id="false" />
      {!connected?.has('true') && (
        <HandlePlus
          handleId="true"
          position="right"
          force={selected}
          anchored={data.pickerAnchorHandle === 'true'}
        />
      )}
      {!connected?.has('false') && (
        <HandlePlus
          handleId="false"
          position="bottom"
          force={selected}
          anchored={data.pickerAnchorHandle === 'false'}
        />
      )}
    </CanvasNodeRoot>
  );
}
