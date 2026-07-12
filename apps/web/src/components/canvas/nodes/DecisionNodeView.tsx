// Decision node — predicate-evaluated branching. Visual: classic flowchart
// diamond, violet tint. LR layout uses the diamond's points meaningfully:
// target on Left (incoming), the `true` (yes) branch leaves the Right point so
// the primary path continues straight ahead, and the `false` (no) branch leaves
// the Bottom point so it drops away below — matching the elkjs port sides, so
// edges never have to double back up across the flow.

import type { DecisionNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import {
  decisionGeometricHandleVisible,
  decisionHandlePlusVisible,
  GEO_SOURCE_BOTTOM,
  GEO_SOURCE_RIGHT,
  GEO_SOURCE_TOP,
} from '../connectionSides.ts';
import { SourceHandlePlus } from './HandlePlus.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type DecisionNodeProps = NodeProps & { data: CanvasNodeData<DecisionNode> };

const SOURCE_HANDLES = [
  { id: GEO_SOURCE_TOP, position: 'top' as const, geometric: true },
  { id: 'true', position: 'right' as const, geometric: false },
  { id: GEO_SOURCE_RIGHT, position: 'right' as const, geometric: true },
  { id: 'false', position: 'bottom' as const, geometric: false },
  { id: GEO_SOURCE_BOTTOM, position: 'bottom' as const, geometric: true },
] as const;

export function DecisionNodeView({ data, selected }: DecisionNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  const used = data.usedDecisionBranches;
  const showRightOut = decisionGeometricHandleVisible(GEO_SOURCE_RIGHT, connected, used);
  const showBottomOut = decisionGeometricHandleVisible(GEO_SOURCE_BOTTOM, connected, used);
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`group relative w-44 h-28 flex items-center justify-center ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      {/* Diamond background via clip-path on a rotated square. */}
      <div
        className="absolute inset-0 bg-node-decision-bg border border-node-decision-border"
        style={{ clipPath: 'polygon(50% 0, 100% 50%, 50% 100%, 0 50%)' }}
      />
      <div className="relative z-10 px-4 text-center">
        <div className="text-[10px] uppercase tracking-wider font-medium text-node-decision-fg">
          Decision
        </div>
        <div className="mt-0.5 text-sm font-medium text-fg-default truncate">
          {node.name ?? node.kind}
        </div>
      </div>
      <Handle type="target" position={Position.Left} className="!z-20" />
      <Handle
        type="source"
        position={Position.Top}
        id={GEO_SOURCE_TOP}
        className="!z-20"
        title="Exit from the top"
      />
      <Handle type="source" position={Position.Right} id="true" className="!z-20" />
      {showRightOut && (
        <Handle
          type="source"
          position={Position.Right}
          id={GEO_SOURCE_RIGHT}
          className="!z-20"
          title="Exit from the right"
        />
      )}
      <Handle type="source" position={Position.Bottom} id="false" className="!z-20" />
      {showBottomOut && (
        <Handle
          type="source"
          position={Position.Bottom}
          id={GEO_SOURCE_BOTTOM}
          className="!z-20"
          title="Exit from the bottom"
        />
      )}
      {SOURCE_HANDLES.map(({ id, position, geometric }) => (
        <SourceHandlePlus
          key={id}
          handleId={id}
          position={position}
          connected={connected}
          force={selected}
          anchored={data.pickerAnchorHandle === id}
          visible={
            geometric
              ? decisionGeometricHandleVisible(id, connected, used)
              : decisionHandlePlusVisible(id, connected, used)
          }
        />
      ))}
    </CanvasNodeRoot>
  );
}
