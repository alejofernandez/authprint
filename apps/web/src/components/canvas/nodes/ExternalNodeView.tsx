// External node — hand-off to an external system (Google, OIDC provider,
// etc.). Visual: rectangle with a teal tint (cool, distinct from Action
// sky) + a small outbound arrow indicator to communicate "you leave the
// flow and come back." LR layout: target Left, on-success Right (happy
// path), failure on Bottom (single handle, like Action).

import type { ExternalNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { HandlePlus } from './HandlePlus.tsx';
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
      title={canvasNodeTitle(data.diagnostics, data.traceTooltip)}
      className={`group relative rounded-md bg-teal-50 dark:bg-teal-950/40 border border-teal-300 dark:border-teal-800 border-t-4 border-t-teal-500 dark:border-t-teal-400 ${canvasNodeRing(data.diagnostics, data.traceState)} ${canvasNodeOpacity(data.traceState)}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <div className="absolute top-1.5 right-2 text-teal-600 dark:text-teal-400" aria-hidden>
        ↗
      </div>
      <NodeShellContent typeLabel="External" name={node.name} id={node.id} kind={node.kind} />
      <Handle type="source" position={Position.Right} id="on-success" />
      <Handle type="source" position={Position.Bottom} id="on-error" />
      {!connected?.has('on-success') && (
        <HandlePlus
          handleId="on-success"
          position="right"
          force={selected}
          anchored={data.pickerAnchorHandle === 'on-success'}
        />
      )}
      {!connected?.has('on-error') && (
        <HandlePlus
          handleId="on-error"
          position="bottom"
          force={selected}
          anchored={data.pickerAnchorHandle === 'on-error'}
        />
      )}
    </CanvasNodeRoot>
  );
}
