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
  layoutSideForScreenInteraction,
  screenInteractionAllowedOnHandle,
} from './connectionSides.ts';
import { flowToReactFlow } from './flowToReactFlow.ts';
import { applyEdgeReconnect } from './ydoc/create.ts';
import { hydrate, readFlow } from './ydoc/hydrate.ts';
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
      effectiveSourceHandle('decision', { type: 'branch', value: false }, { sourceSide: 'right' }),
    ).toBe('true');
    expect(
      effectiveSourceHandle('decision', { type: 'branch', value: true }, { sourceSide: 'bottom' }),
    ).toBe('false');
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

  test('shows geometric handles while an edge is attached', () => {
    expect(decisionGeometricHandleVisible('right-out', new Set(['right-out']))).toBe(true);
    expect(decisionGeometricHandleVisible('bottom-out', new Set(['bottom-out']))).toBe(true);
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
    expect(decision?.data.connectedHandles?.has('false')).toBe(true);
    expect(decision?.data.connectedHandles?.has(GEO_SOURCE_BOTTOM)).toBe(false);
    expect(decision?.data.connectedHandles?.has('true')).toBe(false);
  });
});

describe('screen interaction side tiers', () => {
  test('primary and retreat actions are handle-locked', () => {
    expect(screenInteractionAllowedOnHandle('submit', 'default')).toBe(true);
    expect(screenInteractionAllowedOnHandle('submit', 'alt')).toBe(false);
    expect(screenInteractionAllowedOnHandle('back', 'alt')).toBe(true);
    expect(screenInteractionAllowedOnHandle('back', 'default')).toBe(false);
  });

  test('auxiliary actions may use either handle', () => {
    expect(screenInteractionAllowedOnHandle('resend-code', 'default')).toBe(true);
    expect(screenInteractionAllowedOnHandle('resend-code', 'alt')).toBe(true);
  });

  test('layoutSideForScreenInteraction snaps primary/retreat and preserves flexible side', () => {
    expect(layoutSideForScreenInteraction('submit')).toBeUndefined();
    expect(layoutSideForScreenInteraction('back')).toBeUndefined();
    expect(layoutSideForScreenInteraction('submit', 'bottom')).toBeUndefined();
    expect(layoutSideForScreenInteraction('resend-code', 'bottom')).toBe('bottom');
    expect(layoutSideForScreenInteraction('forgot-password', 'bottom')).toBe('bottom');
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

  test('retargeting an edge end excludes the reconnecting edge from slot checks', () => {
    const actionFlow: Flow = {
      ...flow,
      nodes: [
        ...flow.nodes.filter((n) => n.type !== 'outcome' || n.id === 'o1'),
        {
          type: 'action',
          id: 'a1',
          name: 'POST /authenticate',
          kind: 'validate-credentials',
        },
        {
          type: 'screen',
          id: 's1',
          name: 'Login',
          kind: 'identifier-collect',
          traits: [],
          fields: [],
          fidelity: 'mockup',
        },
        { type: 'outcome', id: 'o2', name: 'New outcome', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'entry', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'e2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
        { id: 'e3', source: 'a1', target: 's1', trigger: { type: 'on-error' } },
      ],
    };
    const doc = hydrate(actionFlow);
    const ok = applyEdgeReconnect(doc, actionFlow, {}, 'e3', {
      source: 'a1',
      target: 'o2',
      sourceHandle: 'on-error',
      targetHandle: null,
    });
    expect(ok).toBe(true);
    expect(readFlow(doc).edges.find((e) => e.id === 'e3')?.target).toBe('o2');
  });

  test('rejects moving a submit edge to the screen bottom handle', () => {
    const screenFlow: Flow = {
      id: 'f',
      name: 'F',
      branding: { theme: 'light' },
      context: {},
      nodes: [
        { type: 'entry', id: 'entry' },
        {
          type: 'screen',
          id: 's1',
          name: 'Login',
          kind: 'identifier-collect',
          traits: [],
          fields: [],
          fidelity: 'lo-fi',
        },
        { type: 'outcome', id: 'o1', name: 'Next', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'e2',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
      annotations: [],
      scenarios: [],
    };
    const doc = hydrate(screenFlow);
    expect(
      applyEdgeReconnect(doc, screenFlow, {}, 'e2', {
        source: 's1',
        target: 'o1',
        sourceHandle: 'alt',
        targetHandle: null,
      }),
    ).toBe(false);
  });

  test('allows moving a resend-code edge to the screen bottom handle', () => {
    const screenFlow: Flow = {
      id: 'f',
      name: 'F',
      branding: { theme: 'light' },
      context: {},
      nodes: [
        { type: 'entry', id: 'entry' },
        {
          type: 'screen',
          id: 's1',
          name: 'OTP',
          kind: 'email-verify',
          traits: [],
          fields: [],
          fidelity: 'lo-fi',
        },
        { type: 'outcome', id: 'o1', name: 'Sent', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'e2',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'resend-code' },
        },
      ],
      annotations: [],
      scenarios: [],
    };
    const doc = hydrate(screenFlow);
    const ok = applyEdgeReconnect(doc, screenFlow, {}, 'e2', {
      source: 's1',
      target: 'o1',
      sourceHandle: 'alt',
      targetHandle: null,
    });
    expect(ok).toBe(true);
    expect(edgeLayoutMap(doc).get('e2')).toEqual({ sourceSide: 'bottom' });
  });
});
