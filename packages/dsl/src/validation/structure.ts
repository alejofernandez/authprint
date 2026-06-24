// US-020 — Graph structure checks: entry presence, reachability, terminability.

import type { Diagnostic } from '../diagnostic.ts';
import type { Edge } from '../schema/edge.ts';
import type { Flow } from '../schema/flow.ts';

export function checkStructure(flow: Flow): Diagnostic[] {
  return [...checkEntryPresence(flow), ...checkReachability(flow), ...checkTerminability(flow)];
}

// ─── Entry presence ─────────────────────────────────────────────────────────

function checkEntryPresence(flow: Flow): Diagnostic[] {
  const entryIndices = flow.nodes.flatMap((n, i) => (n.type === 'entry' ? [i] : []));

  if (entryIndices.length === 0) {
    return [
      {
        severity: 'error',
        code: 'validation-entry-missing',
        message: 'flow has no entry node (exactly one required)',
      },
    ];
  }

  if (entryIndices.length > 1) {
    // Flag every entry beyond the first as the offender (first is the "canonical" one).
    return entryIndices.slice(1).map((idx) => {
      const node = flow.nodes[idx];
      return {
        severity: 'error' as const,
        code: 'validation-entry-multiple' as const,
        message: `flow has ${entryIndices.length} entry nodes; exactly one is required`,
        path: `nodes[${idx}]`,
        ...(node && { target: { kind: 'node' as const, id: node.id } }),
      };
    });
  }

  return [];
}

// ─── Reachability ───────────────────────────────────────────────────────────

function checkReachability(flow: Flow): Diagnostic[] {
  const entry = flow.nodes.find((n) => n.type === 'entry');
  if (!entry) {
    // Entry-presence check already flagged this; nothing more to report here.
    return [];
  }

  const outgoing = buildOutgoingAdjacency(flow.edges);
  const reachable = bfs(entry.id, outgoing);

  return flow.nodes.flatMap((n, idx) =>
    reachable.has(n.id)
      ? []
      : [
          {
            severity: 'error' as const,
            code: 'validation-unreachable-node' as const,
            message: `node '${n.id}' is not reachable from entry`,
            path: `nodes[${idx}]`,
            target: { kind: 'node' as const, id: n.id },
          },
        ],
  );
}

// ─── Terminability ──────────────────────────────────────────────────────────
// Every non-outcome node must be able to reach SOME outcome. Reverse-BFS from
// every outcome marks all ancestors; anything not marked is non-terminable.

function checkTerminability(flow: Flow): Diagnostic[] {
  const incoming = buildIncomingAdjacency(flow.edges);
  const outcomeIds = flow.nodes.filter((n) => n.type === 'outcome').map((n) => n.id);

  const canReachOutcome = new Set<string>();
  const stack: string[] = [...outcomeIds];
  while (stack.length > 0) {
    const id = stack.pop();
    if (id === undefined || canReachOutcome.has(id)) continue;
    canReachOutcome.add(id);
    for (const pred of incoming.get(id) ?? []) {
      if (!canReachOutcome.has(pred)) stack.push(pred);
    }
  }

  return flow.nodes.flatMap((n, idx) =>
    n.type === 'outcome' || canReachOutcome.has(n.id)
      ? []
      : [
          {
            severity: 'error' as const,
            code: 'validation-non-terminable-node' as const,
            message: `node '${n.id}' cannot reach any outcome`,
            path: `nodes[${idx}]`,
            target: { kind: 'node' as const, id: n.id },
          },
        ],
  );
}

// ─── Graph helpers ──────────────────────────────────────────────────────────

function buildOutgoingAdjacency(edges: readonly Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.source) ?? [];
    list.push(edge.target);
    adj.set(edge.source, list);
  }
  return adj;
}

function buildIncomingAdjacency(edges: readonly Edge[]): Map<string, string[]> {
  const adj = new Map<string, string[]>();
  for (const edge of edges) {
    const list = adj.get(edge.target) ?? [];
    list.push(edge.source);
    adj.set(edge.target, list);
  }
  return adj;
}

function bfs(start: string, adjacency: Map<string, string[]>): Set<string> {
  const visited = new Set<string>();
  const queue: string[] = [start];
  while (queue.length > 0) {
    const id = queue.shift();
    if (id === undefined || visited.has(id)) continue;
    visited.add(id);
    for (const n of adjacency.get(id) ?? []) {
      if (!visited.has(n)) queue.push(n);
    }
  }
  return visited;
}
