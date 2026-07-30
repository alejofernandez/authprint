// Outcome node — terminal state. Visual: pill shape, emerald tint (cool —
// success-leaning by default; the kind drives specific visual variants in a
// later epic). LR layout: target on Left, no source handles (terminal).

import type { OutcomeNode } from '@authprint/dsl';
import { Handle, type NodeProps, Position } from '@xyflow/react';
import { GEO_TARGET_BOTTOM, GEO_TARGET_TOP } from '../connectionSides.ts';
import { isWarmOutcomeKind } from '../player/playerClipTone.ts';
import { CanvasNodeRoot, ValidationCue } from './nodeA11y.tsx';
import { canvasNodeOpacity, canvasNodeRing, canvasNodeTitle } from './nodeValidation.ts';
import type { CanvasNodeData } from './shared.ts';

type OutcomeNodeProps = NodeProps & { data: CanvasNodeData<OutcomeNode> };

export function OutcomeNodeView({ data }: OutcomeNodeProps) {
  const { node } = data;
  // A failed ending should not look like a successful one. The player already
  // made this distinction (`isWarmOutcomeKind`, the warm end card); the canvas
  // was the surface still painting every outcome emerald, so "Login failed" and
  // "Authenticated" were the same shape in the same green.
  //
  // Warm rather than red on purpose: `signal-danger` is the validation colour,
  // and a red-filled node next to a red validation ring reads as a broken node
  // rather than a modelled failure. Warm-as-state-signal is the house language
  // and it is exactly what the player uses for these same outcomes.
  const warm = isWarmOutcomeKind('kind' in node ? node.kind : '');
  const surface = warm
    ? 'bg-signal-error-bg border-signal-error-border dark:bg-signal-error-bg-muted dark:border-signal-error-border-strong'
    : 'bg-node-outcome-bg border-node-outcome-border';
  return (
    <CanvasNodeRoot
      nodeId={node.id}
      ariaLabel={data.ariaLabel ?? node.id}
      title={canvasNodeTitle(data.diagnostics)}
      className={`rounded-full border ${surface} ${canvasNodeRing(data.diagnostics)} ${canvasNodeOpacity()}`}
    >
      <ValidationCue diagnostics={data.diagnostics} />
      <Handle type="target" position={Position.Left} />
      <Handle type="target" position={Position.Top} id={GEO_TARGET_TOP} />
      <Handle type="target" position={Position.Bottom} id={GEO_TARGET_BOTTOM} />
      <div className="px-4 py-2 min-w-44 text-center">
        <div
          className={`text-[10px] uppercase tracking-wider font-medium ${warm ? 'text-signal-error-label dark:text-signal-error-fg' : 'text-node-outcome-fg'}`}
        >
          Outcome
        </div>
        <div className="mt-0.5 text-sm font-medium text-fg-default truncate">
          {node.name ?? node.kind}
        </div>
      </div>
    </CanvasNodeRoot>
  );
}
