import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import {
  decisionGeometricHandleVisible,
  decisionHandlePlusVisible,
  defaultSourceSide,
  effectiveSourceHandle,
  effectiveTargetHandle,
  GEO_SOURCE_BOTTOM,
  GEO_SOURCE_TOP,
  GEO_TARGET_TOP,
} from './connectionSides.ts';
import { flowToReactFlow } from './flowToReactFlow.ts';
import { applyEdgeReconnect } from './ydoc/create.ts';
import { hydrate } from './ydoc/hydrate.ts';
import { edgeLayoutMap } from './ydoc/schema.ts';

const flow: Flow = {
  id: 'f',
  name: 'F',
  branding: { theme: 'light' },
  context: {},
  nodes: [
    { type: 'entry', id: 'entry' },
    {
      type: 'decision',
      id: 'd1',
      name: 'Check',
      kind: 'user-exists',
      predicate: { slot: 'u', op: 'equals', value: true },
    },
    { type: 'outcome', id: 'o1', name: 'Yes', kind: 'authenticated' },
    { type: 'outcome', id: 'o2', name: 'No', kind: 'failed' },
  ],
  edges: [
    { id: 'e1', source: 'entry', target: 'd1', trigger: { type: 'unconditional' } },
    { id: 'e2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
    { id: 'e3', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
  ],
  annotations: [],
  scenarios: [],
};

describe('effective handles', () => {
  test('semantic defaults without overrides', () => {
    expect(effectiveSourceHandle('decision', { type: 'branch', value: false })).toBe('false');
    expect(effectiveTargetHandle('outcome')).toBeUndefined();
  });

  test('source side override wins over semantic default', () => {
    expect(
      effectiveSourceHandle('decision', { type: 'branch', value: false }, { sourceSide: 'top' }),
    ).toBe(GEO_SOURCE_TOP);
    expect(
      effectiveSourceHandle('decision', { type: 'branch', value: true }, { sourceSide: 'bottom' }),
    ).toBe(GEO_SOURCE_BOTTOM);
    expect(effectiveTargetHandle('outcome', { targetSide: 'top' })).toBe(GEO_TARGET_TOP);
  });
});

describe('decisionGeometricHandleVisible', () => {
  test('hides redundant right-out and bottom-out when semantic handles are free', () => {
    expect(decisionGeometricHandleVisible('right-out')).toBe(false);
    expect(decisionGeometricHandleVisible('bottom-out')).toBe(false);
    expect(decisionGeometricHandleVisible('top-out')).toBe(true);
  });

  test('hides right-out when yes already uses the true handle', () => {
    const connected = new Set(['true']);
    const used = new Set<'yes' | 'no'>(['yes']);
    expect(decisionGeometricHandleVisible('right-out', connected, used)).toBe(false);
  });
});

describe('decisionHandlePlusVisible', () => {
  test('hides + when handle is connected or branch slot is taken', () => {
    const connected = new Set(['bottom-out']);
    const used = new Set<'yes' | 'no'>(['yes']);
    expect(decisionHandlePlusVisible('bottom-out', connected, used)).toBe(false);
    expect(decisionHandlePlusVisible('false', connected, used)).toBe(true);
    expect(decisionHandlePlusVisible('true', connected, used)).toBe(false);
    expect(decisionHandlePlusVisible('top-out', connected, used)).toBe(true);
  });

  test('hides right-side plus when yes exits from true', () => {
    const connected = new Set(['true']);
    const used = new Set<'yes' | 'no'>(['yes']);
    expect(decisionHandlePlusVisible('true', connected, used)).toBe(false);
    expect(decisionHandlePlusVisible('right-out', connected, used)).toBe(false);
  });

  test('still shows false plus when yes exits from bottom-out', () => {
    const connected = new Set(['bottom-out']);
    const used = new Set<'yes' | 'no'>(['yes']);
    expect(decisionHandlePlusVisible('false', connected, used)).toBe(true);
    expect(decisionHandlePlusVisible('bottom-out', connected, used)).toBe(false);
  });
});

describe('flowToReactFlow override mapping', () => {
  test('uses recorded side overrides on edges', () => {
    const { edges } = flowToReactFlow(flow, {}, { e3: { sourceSide: 'top' } });
    const noBranch = edges.find((e) => e.id === 'e3');
    expect(noBranch?.sourceHandle).toBe(GEO_SOURCE_TOP);
    expect(defaultSourceSide({ type: 'branch', value: false })).toBe('bottom');
  });

  test('connectedHandles tracks effective handles so semantic slots stay independent', () => {
    const yesOnly: Flow = {
      ...flow,
      edges: flow.edges.filter((e) => e.id !== 'e3'),
    };
    const { nodes } = flowToReactFlow(yesOnly, {}, { e2: { sourceSide: 'bottom' } });
    const decision = nodes.find((n) => n.id === 'd1');
    expect(decision?.data.connectedHandles?.has(GEO_SOURCE_BOTTOM)).toBe(true);
    expect(decision?.data.connectedHandles?.has('false')).toBe(false);
    expect(decision?.data.connectedHandles?.has('true')).toBe(false);
  });
});

describe('applyEdgeReconnect', () => {
  test('records a source-side override on same-node reconnect', () => {
    const doc = hydrate(flow);
    const ok = applyEdgeReconnect(doc, flow, {}, 'e3', {
      source: 'd1',
      target: 'o2',
      sourceHandle: GEO_SOURCE_TOP,
      targetHandle: null,
    });
    expect(ok).toBe(true);
    expect(edgeLayoutMap(doc).get('e3')).toEqual({ sourceSide: 'top' });
  });

  test('clears override when reconnected to the semantic default side', () => {
    const doc = hydrate(flow, {}, { e3: { sourceSide: 'top' } });
    const ok = applyEdgeReconnect(doc, flow, { e3: { sourceSide: 'top' } }, 'e3', {
      source: 'd1',
      target: 'o2',
      sourceHandle: 'false',
      targetHandle: null,
    });
    expect(ok).toBe(true);
    expect(edgeLayoutMap(doc).has('e3')).toBe(false);
  });
});
