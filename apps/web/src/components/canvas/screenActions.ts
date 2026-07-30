// Screen actions are derived from outgoing interaction edges (US-126 / §5
// layer 4). View concern — lives beside edgeTriggerUtils, not in @authprint/dsl
// (Principle 2; same relocation precedent as US-114 side tiers).

import { type Flow, isSocialAction } from '@authprint/dsl';
import { screenInteractionSideTier } from './screenInteractionSides.ts';

export type ScreenAction = {
  action: string;
  edgeId: string;
  targetId: string;
  /** Display name of the target node (inspector). */
  targetName: string;
  /**
   * Primary = submit/accept (the kind CTA draws it). Social = a provider
   * sign-in, drawn as a button in the provider cluster rather than a link,
   * because a stack of "Social google" links is not what the screen looks like.
   * Secondary = everything else, text links beneath the CTA.
   */
  prominence: 'primary' | 'secondary' | 'social';
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
      prominence: isSocialAction(action)
        ? 'social'
        : screenInteractionSideTier(action) === 'primary'
          ? 'primary'
          : 'secondary',
    });
  }
  return actions;
}

/**
 * The two groups a screen mockup draws below its CTA, from one derivation.
 *
 * Deliberately one function rather than a `.filter()` at each call site: there
 * are four of them (canvas, player stage, player backdrop, node inspector) and
 * UF-048 was exactly one of them being missed, which shrank the card. A caller
 * that wants one group still gets both, so a new group cannot be forgotten.
 */
export function screenActionGroups(
  flow: Flow,
  screenId: string,
): { secondary: string[]; social: string[] } {
  const actions = screenActions(flow, screenId);
  return {
    secondary: actions.filter((a) => a.prominence === 'secondary').map((a) => a.action),
    social: actions.filter((a) => a.prominence === 'social').map((a) => a.action),
  };
}
