// Action node — server-side step. Visual: rectangle with a sky-blue tint
// (cool, distinct from Screen indigo). LR layout: target on Left, on-success
// continues to the Right (happy path), on-error branches down to the Bottom
// (exception path). The visual separation reinforces "success continues the
// flow; error diverts."

import type { ActionNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { SourceHandlePlus } from './HandlePlus.tsx';
import { NodeShellContent } from './NodeShell.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type ActionNodeProps = NodeProps & { data: CanvasNodeData<ActionNode> };

export function ActionNodeView({ data, selected }: ActionNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`group relative rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-300 dark:border-sky-800 border-t-4 border-t-sky-500 dark:border-t-sky-400 ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <NodeShellContent typeLabel="Action" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Right} id="on-success" />
      <Handle type="source" position={Position.Bottom} id="on-error" />
      <SourceHandlePlus
        handleId="on-success"
        position="right"
        connected={connected}
        force={selected}
        anchored={data.pickerAnchorHandle === 'on-success'}
      />
      <SourceHandlePlus
        handleId="on-error"
        position="bottom"
        connected={connected}
        force={selected}
        anchored={data.pickerAnchorHandle === 'on-error'}
      />
    </CanvasNodeRoot>
  );
}
