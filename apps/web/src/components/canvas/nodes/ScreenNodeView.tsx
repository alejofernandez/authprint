// Screen node — user-facing step. Visual: rounded rectangle with an indigo
// tint and a top accent bar (LR layout — left edge is reserved for target
// handle, so the accent moved up). Handles: target on Left, source on Right
// for the primary user action; secondary source on Bottom for alternative
// actions (cancel, back, etc.) post-E26.

import type { ScreenNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { HandlePlus } from './HandlePlus.tsx';
import { validationRing, validationTitle } from './nodeValidation.ts';
import { ScreenFidelityView } from './screen/ScreenFidelityView.tsx';
import type { CanvasNodeData } from './shared.ts';

type ScreenNodeProps = NodeProps & { data: CanvasNodeData<ScreenNode> };

// All three fidelity tiers render through ScreenFidelityView (US-069). Mockup
// and wireframe share the card chrome wrapper; lo-fi is a compact titled box.
export function ScreenNodeView({ data, selected }: ScreenNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  const isCardTier = node.fidelity === 'mockup' || node.fidelity === 'wireframe';
  // Each `+` hides once its handle carries an edge (like every other node type).
  // A second interaction off an already-wired handle is added via drag-from-
  // handle (US-050), not by stacking another `+` on a connected handle.
  return (
    <div
      className={`group relative ${isCardTier ? 'rounded-xl' : 'rounded-lg'} ${validationRing(data.diagnostics)}`}
      title={validationTitle(data.diagnostics)}
    >
      <Handle type="target" position={Position.Left} />
      <ScreenFidelityView node={node} />
      <Handle type="source" position={Position.Right} id="default" />
      <Handle type="source" position={Position.Bottom} id="alt" />
      {!connected?.has('default') && (
        <HandlePlus
          handleId="default"
          position="right"
          force={selected}
          anchored={data.pickerAnchorHandle === 'default'}
        />
      )}
      {!connected?.has('alt') && (
        <HandlePlus
          handleId="alt"
          position="bottom"
          force={selected}
          anchored={data.pickerAnchorHandle === 'alt'}
        />
      )}
    </div>
  );
}
