import { describe, expect, test } from 'bun:test';
import type { Edge as RfEdge, Node as RfNode } from '@xyflow/react';
import type { CanvasNodeData } from './nodes/index.ts';
import { reconcileFlowEdges, reconcileFlowNodes } from './reconcileFlowState.ts';

function node(
  id: string,
  x: number,
  y: number,
  extra?: Partial<RfNode<CanvasNodeData>>,
): RfNode<CanvasNodeData> {
  return {
    id,
    type: 'screen',
    position: { x, y },
    data: {
      node: { id, type: 'screen', title: id, interactions: [] },
      ariaLabel: id,
    },
    ...extra,
  };
}

describe('reconcileFlowNodes', () => {
  test('preserves object identity when only incoming array is new', () => {
    const current = [node('a', 0, 0), node('b', 10, 20)];
    const incoming = current.map((n) => ({ ...n, data: { ...n.data } }));
    const next = reconcileFlowNodes(current, incoming);
    expect(next).toBe(current);
    expect(next[0]).toBe(current[0]);
    expect(next[1]).toBe(current[1]);
  });

  test('updates position when it changes', () => {
    const current = [node('a', 0, 0)];
    const incoming = [node('a', 5, 0)];
    const next = reconcileFlowNodes(current, incoming);
    expect(next).not.toBe(current);
    expect(next[0]?.position).toEqual({ x: 5, y: 0 });
  });

  test('keeps dragging node reference', () => {
    const current = [node('a', 0, 0, { dragging: true })];
    const incoming = [node('a', 50, 0)];
    const next = reconcileFlowNodes(current, incoming);
    expect(next[0]).toBe(current[0]);
    expect(next[0]?.position).toEqual({ x: 0, y: 0 });
  });
});

describe('reconcileFlowEdges', () => {
  const base: RfEdge = {
    id: 'e1',
    source: 'a',
    target: 'b',
    type: 'routable',
    data: { waypoints: [{ x: 1, y: 2 }] },
  };

  test('preserves identity when waypoints unchanged', () => {
    const current = [base];
    const incoming = [{ ...base, data: { waypoints: [{ x: 1, y: 2 }] } }];
    const next = reconcileFlowEdges(current, incoming);
    expect(next).toBe(current);
    expect(next[0]).toBe(current[0]);
  });

  test('updates waypoints when they change', () => {
    const current = [base];
    const incoming = [{ ...base, data: { waypoints: [{ x: 9, y: 2 }] } }];
    const next = reconcileFlowEdges(current, incoming);
    expect(next[0]?.data).toEqual({ waypoints: [{ x: 9, y: 2 }] });
  });

  test('preserves selection on route commit refresh', () => {
    const current = [{ ...base, selected: true }];
    const incoming = [{ ...base, data: { waypoints: [{ x: 3, y: 4 }] } }];
    const next = reconcileFlowEdges(current, incoming);
    expect(next[0]?.selected).toBe(true);
    expect(next[0]?.data).toEqual({ waypoints: [{ x: 3, y: 4 }] });
  });
});
