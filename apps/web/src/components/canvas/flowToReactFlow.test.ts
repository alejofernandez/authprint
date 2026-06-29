import { describe, expect, test } from 'bun:test';
import type { Diagnostic, Flow } from '@authprint/dsl';
import { flowToReactFlow } from './flowToReactFlow.ts';

const flow: Flow = {
  id: 'f',
  name: 'X',
  theme: 'light',
  context: {},
  nodes: [
    { type: 'entry', id: 'entry' },
    { type: 'action', id: 'a1', name: 'A', kind: 'send-otp' },
    { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
  ],
  edges: [{ id: 'e1', source: 'entry', target: 'a1', trigger: { type: 'unconditional' } }],
  annotations: [],
  scenarios: [],
};

const err = (): Diagnostic => ({
  severity: 'error',
  code: 'validation-action-missing-error-edge',
  message: 'boom',
});

describe('flowToReactFlow — validation attachment (E33)', () => {
  test('attaches node diagnostics and colors flagged edges', () => {
    const { nodes, edges } = flowToReactFlow(
      flow,
      {},
      {},
      { byNode: new Map([['a1', [err()]]]), byEdge: new Map([['e1', [err()]]]) },
    );
    expect(nodes.find((n) => n.id === 'a1')?.data.diagnostics).toHaveLength(1);
    expect(nodes.find((n) => n.id === 'entry')?.data.diagnostics).toBeUndefined();
    expect(nodes.find((n) => n.id === 'a1')?.data.ariaLabel).toContain('Action node: A');

    const edge = edges.find((e) => e.id === 'e1');
    expect(edge?.style?.stroke).toBe('#ef4444'); // red for error
  });

  test('no validation → no diagnostics, default edge styling', () => {
    const { nodes, edges } = flowToReactFlow(flow, {});
    expect(nodes.every((n) => n.data.diagnostics === undefined)).toBe(true);
    expect(edges[0]?.style).toBeUndefined();
    expect(edges[0]?.type).toBe('routable');
  });

  test('edge routes attach waypoints on routable edges', () => {
    const route = [{ x: 40, y: 90 }];
    const { edges } = flowToReactFlow(flow, {}, { e1: route });
    expect(edges[0]?.type).toBe('routable');
    expect(edges[0]?.data).toEqual({ waypoints: route });
  });
});
