// US-119 — legal screen exit actions derived from flow edges (record mode).

import type { Flow } from '@authprint/dsl';
import { labelFor } from '../flowToReactFlow.ts';
import {
  resolveScreenActionHighlightTarget,
  type ScreenActionHighlightTarget,
} from '../nodes/screen/screenActionHighlight.tsx';

export type ScreenExitAction = {
  actionId: string;
  label: string;
  /** When not `callout`, the action maps to an on-screen affordance in mockup/wireframe tiers. */
  highlightTarget: ScreenActionHighlightTarget;
};

export function screenExitActions(flow: Flow, screenNodeId: string): ScreenExitAction[] {
  const node = flow.nodes.find((n) => n.id === screenNodeId && n.type === 'screen');
  if (node?.type !== 'screen') return [];

  const actions: ScreenExitAction[] = [];
  const seen = new Set<string>();

  for (const edge of flow.edges) {
    if (edge.source !== screenNodeId || edge.trigger.type !== 'interaction') continue;
    const actionId = edge.trigger.action;
    if (seen.has(actionId)) continue;
    seen.add(actionId);
    actions.push({
      actionId,
      label: edge.label ?? labelFor(edge.trigger) ?? actionId,
      highlightTarget: resolveScreenActionHighlightTarget(
        actionId,
        node.traits,
        node.fields,
        node.kind,
      ),
    });
  }

  return actions.sort((a, b) => a.actionId.localeCompare(b.actionId));
}

export function actionExternalResults(nodeType: 'action' | 'external'): readonly string[] {
  return nodeType === 'external'
    ? (['success', 'error', 'denied', 'cancelled'] as const)
    : (['success', 'error'] as const);
}

export function nodeDisplayName(flow: Flow, nodeId: string): string {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return nodeId;
  if ('name' in node && node.name) return node.name;
  if ('kind' in node && node.kind) return node.kind;
  return node.id;
}
