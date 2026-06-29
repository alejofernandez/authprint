// Screen-reader labels for canvas nodes (US-077). Built from the DSL node +
// its edges — "<Type> node: <name> (<kind>)" plus an outgoing connection
// summary when there is exactly one primary edge to announce.

import type { Flow, Node, Trigger } from '@authprint/dsl';

const TYPE_LABEL: Record<Node['type'], string> = {
  entry: 'Entry',
  screen: 'Screen',
  decision: 'Decision',
  action: 'Action',
  external: 'External',
  outcome: 'Outcome',
};

function displayName(node: Node): string {
  if ('name' in node && node.name) return node.name;
  if ('kind' in node && node.kind) return node.kind;
  return node.id;
}

function triggerLabel(trigger: Trigger): string | undefined {
  switch (trigger.type) {
    case 'interaction':
      return trigger.action;
    case 'branch':
      return trigger.value ? 'yes' : 'no';
    case 'on-success':
      return 'success';
    case 'on-error':
      return 'error';
    case 'on-denied':
      return 'denied';
    case 'on-cancelled':
      return 'cancelled';
    default:
      return undefined;
  }
}

function kindSuffix(node: Node): string {
  if ('kind' in node && node.kind) return ` (${node.kind})`;
  return '';
}

function connectionSummary(flow: Flow, nodeId: string): string | undefined {
  const outgoing = flow.edges.filter((e) => e.source === nodeId);
  if (outgoing.length === 0) return undefined;

  const summaries = outgoing
    .map((edge) => {
      const target = flow.nodes.find((n) => n.id === edge.target);
      const via = triggerLabel(edge.trigger);
      if (!target || !via) return null;
      return `${displayName(target)} via ${via}`;
    })
    .filter((s): s is string => s !== null);

  if (summaries.length === 0) return undefined;
  if (summaries.length === 1) return `Connected to ${summaries[0]}`;
  return `Connected to ${summaries.join('; ')}`;
}

/** Accessible name for a flow node, including an outgoing-edge summary when derivable. */
export function buildNodeAriaLabel(flow: Flow, nodeId: string): string {
  const node = flow.nodes.find((n) => n.id === nodeId);
  if (!node) return 'Flow node';

  const base = `${TYPE_LABEL[node.type]} node: ${displayName(node)}${kindSuffix(node)}`;
  const connections = connectionSummary(flow, nodeId);
  return connections ? `${base}. ${connections}` : base;
}
