import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { checkEdgeCompleteness } from './edge-completeness.ts';

describe('checkEdgeCompleteness — decision branches', () => {
  test('decision with both true + false branches → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'x.y', op: 'equals', value: true },
        },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'B', kind: 'denied' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
        { id: 'edge-3', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
      ],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).not.toContain('validation-decision-branch-missing');
    expect(codes).not.toContain('validation-decision-branch-extra');
  });

  test('decision missing false branch → branch-missing error for false', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'x.y', op: 'equals', value: true },
        },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      ],
    });
    const errs = checkEdgeCompleteness(flow).filter(
      (d) => d.code === 'validation-decision-branch-missing',
    );
    expect(errs.length).toBe(1);
    expect(errs[0]?.message).toContain('false');
  });

  test('decision with 3 branches → branch-extra error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'x.y': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'x.y', op: 'equals', value: true },
        },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'B', kind: 'denied' },
        { type: 'outcome', id: 'o3', name: 'C', kind: 'abandoned' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
        { id: 'edge-3', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
        { id: 'edge-4', source: 'd1', target: 'o3', trigger: { type: 'branch', value: true } },
      ],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).toContain('validation-decision-branch-extra');
  });
});

describe('checkEdgeCompleteness — action result edges', () => {
  test('action with both success + error → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'action', id: 'a1', name: 'Send', kind: 'send-otp' },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'B', kind: 'error' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'a1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
        { id: 'edge-3', source: 'a1', target: 'o2', trigger: { type: 'on-error' } },
      ],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).not.toContain('validation-action-missing-success-edge');
    expect(codes).not.toContain('validation-action-missing-error-edge');
  });

  test('action missing error edge → missing-error error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'action', id: 'a1', name: 'Send', kind: 'send-otp' },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'a1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
      ],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).toContain('validation-action-missing-error-edge');
    expect(codes).not.toContain('validation-action-missing-success-edge');
  });
});

describe('checkEdgeCompleteness — external + outcome', () => {
  test('external missing both edges → both missing errors', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'external', id: 'x1', name: 'Google', kind: 'google' },
      ],
      edges: [{ id: 'edge-1', source: 'e1', target: 'x1', trigger: { type: 'unconditional' } }],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).toContain('validation-external-missing-success-edge');
    expect(codes).toContain('validation-external-missing-error-edge');
  });

  test('outcome with outgoing edge → outcome-has-outgoing error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'B', kind: 'denied' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'o1', target: 'o2', trigger: { type: 'unconditional' } },
      ],
    });
    const codes = checkEdgeCompleteness(flow).map((d) => d.code);
    expect(codes).toContain('validation-outcome-has-outgoing-edge');
    // Also fires trigger-incompatible-with-source (intentional double-flag).
    expect(codes).toContain('validation-trigger-incompatible-with-source');
  });
});

describe('checkEdgeCompleteness — duplicate screen interactions', () => {
  test('two submit edges from one screen → duplicate-interaction error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'screen', id: 's1', name: 'A', kind: 'password' },
        { type: 'screen', id: 's2', name: 'B', kind: 'password' },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'edge-2',
          source: 's1',
          target: 's2',
          trigger: { type: 'interaction', action: 'submit' },
        },
        {
          id: 'edge-3',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    const errs = checkEdgeCompleteness(flow).filter(
      (d) => d.code === 'validation-screen-duplicate-interaction',
    );
    expect(errs.length).toBe(1);
    expect(errs[0]?.message).toContain('submit');
  });
});
