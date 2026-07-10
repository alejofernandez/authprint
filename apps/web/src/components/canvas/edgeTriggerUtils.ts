import type { Edge, Flow, Trigger } from '@authprint/dsl';

/** Triggers the edge editor can change (not unconditional or external denied/cancelled). */
export function isEditableEdgeTrigger(trigger: Trigger): boolean {
  switch (trigger.type) {
    case 'branch':
    case 'interaction':
    case 'on-success':
    case 'on-error':
      return true;
    default:
      return false;
  }
}

/** Closed-pair sibling for swap (decision yes/no, action/external success/error). */
export function findSwappableSiblingEdge(flow: Flow, edge: Edge): Edge | null {
  if (edge.trigger.type === 'branch') {
    const branchTrigger = edge.trigger;
    return (
      flow.edges.find(
        (e) =>
          e.id !== edge.id &&
          e.source === edge.source &&
          e.trigger.type === 'branch' &&
          e.trigger.value !== branchTrigger.value,
      ) ?? null
    );
  }

  if (edge.trigger.type === 'on-success' || edge.trigger.type === 'on-error') {
    const siblingType = edge.trigger.type === 'on-success' ? 'on-error' : 'on-success';
    return (
      flow.edges.find(
        (e) => e.id !== edge.id && e.source === edge.source && e.trigger.type === siblingType,
      ) ?? null
    );
  }

  return null;
}

/** Interaction actions already used by other outgoing edges from the same screen. */
export function usedScreenInteractionActions(flow: Flow, edge: Edge): Set<string> {
  const used = new Set<string>();
  for (const e of flow.edges) {
    if (e.id === edge.id || e.source !== edge.source || e.trigger.type !== 'interaction') continue;
    used.add(e.trigger.action);
  }
  return used;
}
