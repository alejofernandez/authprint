// Screen node — user-facing step. Visual: rounded card with an indigo tint.
// Handles: target on Left, source on Right for the primary user action;
// secondary source on Bottom for alternative actions (cancel, back, etc.)
// post-E26. Every screen renders as a mockup (US-124).

import type { ScreenNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { GEO_SOURCE_TOP } from '../connectionSides.ts';
import { SourceHandlePlus } from './HandlePlus.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import { ScreenMockup } from './screen/ScreenMockup.tsx';
import { screenThemeClass } from './screen/screenTheme.ts';
import type { CanvasNodeData } from './shared.ts';

type ScreenNodeProps = NodeProps & { data: CanvasNodeData<ScreenNode> };

export function ScreenNodeView({ data, selected }: ScreenNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  // Each `+` hides once its handle carries an edge (like every other node type).
  // A second interaction off an already-wired handle is added via drag-from-
  // handle (US-050), not by stacking another `+` on a connected handle.
  // Top-out (UF-040) is drag/reconnect only — no `+`, so resting chrome stays
  // the completeness signal (§7) and node baselines do not grow a third affordance.
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`group relative rounded-xl ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <div className={screenThemeClass(data.screenTheme ?? 'light')}>
        <ScreenMockup
          node={node}
          branding={data.branding}
          displayErrorState={data.displayErrorState}
          secondaryActions={data.secondaryActions}
          socialActions={data.socialActions}
        />
      </div>
      <Handle type="source" position={Position.Top} id={GEO_SOURCE_TOP} title="Exit from the top" />
      <Handle type="source" position={Position.Right} id="default" />
      <Handle type="source" position={Position.Bottom} id="alt" />
      <SourceHandlePlus
        handleId="default"
        position="right"
        connected={connected}
        force={selected}
        anchored={data.pickerAnchorHandle === 'default'}
      />
      <SourceHandlePlus
        handleId="alt"
        position="bottom"
        connected={connected}
        force={selected}
        anchored={data.pickerAnchorHandle === 'alt'}
      />
    </CanvasNodeRoot>
  );
}
