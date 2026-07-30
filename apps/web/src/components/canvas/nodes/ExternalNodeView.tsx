// External node — hand-off to an external system (Google, OIDC provider,
// etc.). Visual: rectangle with a teal tint (cool, distinct from Action
// sky) + a small outbound arrow indicator to communicate "you leave the
// flow and come back." LR layout: target Left, on-success Right (happy
// path), failure on Bottom (single handle, like Action).

import type { ExternalNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { GEO_SOURCE_TOP, GEO_TARGET_BOTTOM, GEO_TARGET_TOP } from '../connectionSides.ts';
import { SourceHandlePlus } from './HandlePlus.tsx';
import { NodeShellContent } from './NodeShell.tsx';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type ExternalNodeProps = NodeProps & { data: CanvasNodeData<ExternalNode> };

export function ExternalNodeView({ data, selected }: ExternalNodeProps) {
  const { node } = data;
  const connected = data.connectedHandles;
  // `+` covers the mandatory success/error paths. denied/cancelled stay in the
  // model but share the single bottom handle (routed there by sourceHandleFor);
  // they get first-class handles later via drag-from-handle (US-050).
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`group relative rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 border-t-4 border-t-teal-500 dark:border-t-teal-400 ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      {/* External is the one node with both an entrance and an exit on top, so
          they are offset rather than stacked on the same point: the incoming
          handle sits left of centre and the outgoing one right of it. */}
      <Handle type="target" position={Position.Top} id={GEO_TARGET_TOP} style={{ left: '35%' }} />
      <Handle type="target" position={Position.Bottom} id={GEO_TARGET_BOTTOM} />
      <div className="absolute top-1.5 right-2 text-teal-600 dark:text-teal-400" aria-hidden>
        ↗
      </div>
      <NodeShellContent typeLabel="External" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Right} id="on-success" />
      <Handle type="source" position={Position.Bottom} id="on-error" />
      <Handle type="source" position={Position.Top} id={GEO_SOURCE_TOP} style={{ left: '65%' }} />
      <SourceHandlePlus
        handleId={GEO_SOURCE_TOP}
        position="top"
        connected={connected}
        force={selected}
        anchored={data.pickerAnchorHandle === GEO_SOURCE_TOP}
      />
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
