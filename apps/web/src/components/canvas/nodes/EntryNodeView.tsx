// Entry node — flow start. Visual: small circle, neutral cool gray.
// LR layout: single source handle on the right (one outgoing unconditional edge).

import type { EntryNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { SourceHandlePlus } from './HandlePlus.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type EntryNodeProps = NodeProps & { data: CanvasNodeData<EntryNode> };

export function EntryNodeView({ data, selected }: EntryNodeProps) {
  return (
    <CanvasNodeRoot
      nodeId={data.node.id}
      ariaLabel={data.ariaLabel ?? data.node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`group relative ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <div className="h-16 w-16 rounded-full bg-node-entry-bg border-2 border-node-entry-border flex items-center justify-center">
        <div className="text-[10px] uppercase tracking-wider font-semibold text-node-entry-fg">
          Start
        </div>
      </div>
      <div className="absolute -bottom-5 left-1/2 -translate-x-1/2 text-[10px] font-mono text-fg-subtle">
        {data.node.id}
      </div>
      <Handle type="source" position={Position.Right} />
      <SourceHandlePlus
        handleId={null}
        position="right"
        connected={data.connectedHandles}
        force={selected}
        anchored={data.pickerAnchorHandle === null}
      />
    </CanvasNodeRoot>
  );
}
