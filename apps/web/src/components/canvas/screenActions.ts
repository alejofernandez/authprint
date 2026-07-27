// Screen actions are derived from outgoing interaction edges (US-126 / §5
// layer 4). View concern — lives beside edgeTriggerUtils, not in @authprint/dsl
// (Principle 2; same relocation precedent as US-114 side tiers).

import type { Flow } from '@authprint/dsl';
import { screenInteractionSideTier } from './screenInteractionSides.ts';

export type ScreenAction = {
  action: string;
  edgeId: string;
  targetId: string;
  /** Display name of the target node (inspector). */
  targetName: string;
  /**
   * Primary = submit/accept (kind CTA covers it). Secondary = everything else,
   * rendered as text links beneath the CTA.
   */
  prominence: 'primary' | 'secondary';
};

function targetDisplayName(flow: Flow, nodeId: string): string {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  if ('name' in node && node.name) return node.name;
  if ('kind' in node && node.kind) return node.kind;
  return node.id;
}

/** Outgoing interaction actions for a screen, in graph (edge-list) order. */
export function screenActions(flow: Flow, screenId: string): ScreenAction[] {
  const actions: ScreenAction[] = [];
  for (const edge of flow.edges) {
    if (edge.source !== screenId || edge.trigger.type !== 'interaction') continue;
    const action = edge.trigger.action;
    actions.push({
      action,
      edgeId: edge.id,
      targetId: edge.target,
      targetName: targetDisplayName(flow, edge.target),
      prominence: screenInteractionSideTier(action) === 'primary' ? 'primary' : 'secondary',
    });
  }
  return actions;
}
