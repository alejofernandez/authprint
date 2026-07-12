// Keep React Flow node/edge object identity stable when the Y.Doc-derived graph
// refreshes without meaningful per-element changes (e.g. edgeLayout commit while
// node positions stay put). Replacing every node forces handle remeasure and a
// ~SMOOTHSTEP_OFFSET flicker on connected routable edges.

import type { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import type { CanvasNodeData } from './nodes/index.ts';
import type { Position } from './ydoc/schema.ts';

function connectedHandlesEqual(
  a: ReadonlySet<string> | undefined,
  b: ReadonlySet<string> | undefined,
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.size !== b.size) return false;
  for (const handle of a) if (!b.has(handle)) return false;
  return true;
}

function diagnosticsEqual(
  a: CanvasNodeData['diagnostics'],
  b: CanvasNodeData['diagnostics'],
): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  if (a.length !== b.length) return false;
  return a.every((d, i) => {
    const other = b[i];
    return (
      other !== undefined &&
      d.severity === other.severity &&
      d.message === other.message &&
      d.path === other.path
    );
  });
}

function usedDecisionBranchesEqual(
  a: ReadonlySet<'yes' | 'no'> | undefined,
  b: ReadonlySet<'yes' | 'no'> | undefined,
): boolean {
  return connectedHandlesEqual(a, b);
}

function canvasNodeDataEqual(a: CanvasNodeData, b: CanvasNodeData): boolean {
  if (a.ariaLabel !== b.ariaLabel) return false;
  if (a.screenTheme !== b.screenTheme) return false;
  if (a.pickerAnchorHandle !== b.pickerAnchorHandle) return false;
  if (!diagnosticsEqual(a.diagnostics, b.diagnostics)) return false;
  if (!connectedHandlesEqual(a.connectedHandles, b.connectedHandles)) return false;
  if (!usedDecisionBranchesEqual(a.usedDecisionBranches, b.usedDecisionBranches)) return false;
  if (a.node === b.node) return true;
  if (a.node.id !== b.node.id || a.node.type !== b.node.type) return false;
  return JSON.stringify(a.node) === JSON.stringify(b.node);
}

function waypointsEqual(a: Position[], b: Position[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    return q !== undefined && p.x === q.x && p.y === q.y;
  });
}

function edgeDataEqual(a: unknown, b: unknown): boolean {
  const wa = ((a as { waypoints?: Position[] } | undefined)?.waypoints ?? []) as Position[];
  const wb = ((b as { waypoints?: Position[] } | undefined)?.waypoints ?? []) as Position[];
  return waypointsEqual(wa, wb);
}

function styleEqual(a: RfEdge['style'], b: RfEdge['style']): boolean {
  if (a === b) return true;
  if (!a || !b) return !a && !b;
  return a.stroke === b.stroke && a.strokeWidth === b.strokeWidth;
}

export function reconcileFlowNodes<T extends RfNode<CanvasNodeData>>(
  current: T[],
  incoming: T[],
): T[] {
  const currentById = new Map(current.map((node) => [node.id, node]));
  let changed = current.length !== incoming.length;
  const next = incoming.map((inc) => {
    const prev = currentById.get(inc.id);
    if (!prev) {
      changed = true;
      return inc;
    }
    currentById.delete(inc.id);
    if (prev.dragging) return prev;
    if (
      prev.position.x === inc.position.x &&
      prev.position.y === inc.position.y &&
      prev.selected === inc.selected &&
      prev.type === inc.type &&
      canvasNodeDataEqual(prev.data, inc.data)
    ) {
      return prev;
    }
    changed = true;
    return { ...prev, ...inc };
  });
  if (currentById.size > 0) changed = true;
  return changed ? next : current;
}

export function reconcileFlowEdges(current: RfEdge[], incoming: RfEdge[]): RfEdge[] {
  const currentById = new Map(current.map((edge) => [edge.id, edge]));
  let changed = current.length !== incoming.length;
  const next = incoming.map((inc) => {
    const prev = currentById.get(inc.id);
    if (!prev) {
      changed = true;
      return inc;
    }
    currentById.delete(inc.id);
    const selected = Boolean(prev.selected || inc.selected);
    const prevSelected = Boolean(prev.selected);
    if (
      prev.source === inc.source &&
      prev.target === inc.target &&
      prev.sourceHandle === inc.sourceHandle &&
      prev.targetHandle === inc.targetHandle &&
      prev.label === inc.label &&
      prev.type === inc.type &&
      edgeDataEqual(prev.data, inc.data) &&
      styleEqual(prev.style, inc.style) &&
      prev.markerEnd === inc.markerEnd &&
      prevSelected === selected
    ) {
      return prev;
    }
    changed = true;
    return selected ? { ...inc, selected: true } : inc;
  });
  if (currentById.size > 0) changed = true;
  return changed ? next : current;
}
