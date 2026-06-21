import { describe, expect, test } from 'bun:test';
import { EdgeSchema, TriggerSchema, validateEdgeTrigger } from './edge.ts';

describe('Trigger schemas', () => {
  test('parses unconditional trigger', () => {
    const r = TriggerSchema.safeParse({ type: 'unconditional' });
    expect(r.success).toBe(true);
  });

  test('parses interaction trigger', () => {
    const r = TriggerSchema.safeParse({ type: 'interaction', action: 'submit' });
    expect(r.success).toBe(true);
  });

  test('parses branch trigger with boolean value', () => {
    const r = TriggerSchema.safeParse({ type: 'branch', value: true });
    expect(r.success).toBe(true);
  });

  test('rejects branch trigger with non-boolean value (v1 constraint)', () => {
    const r = TriggerSchema.safeParse({ type: 'branch', value: 'yes' });
    expect(r.success).toBe(false);
  });

  test('parses on-success / on-error / on-denied / on-cancelled', () => {
    for (const type of ['on-success', 'on-error', 'on-denied', 'on-cancelled'] as const) {
      const r = TriggerSchema.safeParse({ type });
      expect(r.success).toBe(true);
    }
  });

  test('rejects unknown trigger type', () => {
    const r = TriggerSchema.safeParse({ type: 'unknown-trigger' });
    expect(r.success).toBe(false);
  });

  test('interaction trigger requires non-empty action', () => {
    const r = TriggerSchema.safeParse({ type: 'interaction', action: '' });
    expect(r.success).toBe(false);
  });
});

describe('Edge schema', () => {
  test('parses minimal edge', () => {
    const r = EdgeSchema.safeParse({
      id: 'e1',
      source: 'a',
      target: 'b',
      trigger: { type: 'unconditional' },
    });
    expect(r.success).toBe(true);
  });

  test('rejects self-loop', () => {
    const r = EdgeSchema.safeParse({
      id: 'e1',
      source: 'a',
      target: 'a',
      trigger: { type: 'unconditional' },
    });
    expect(r.success).toBe(false);
  });

  test('accepts optional label', () => {
    const r = EdgeSchema.safeParse({
      id: 'e1',
      source: 'a',
      target: 'b',
      trigger: { type: 'interaction', action: 'submit' },
      label: 'on submit',
    });
    expect(r.success).toBe(true);
  });
});

describe('validateEdgeTrigger', () => {
  const baseEdge = {
    id: 'e1',
    source: 'a',
    target: 'b',
  };

  test('entry → unconditional ok', () => {
    const edge = { ...baseEdge, trigger: { type: 'unconditional' as const } };
    expect(validateEdgeTrigger(edge, 'entry')).toBeNull();
  });

  test('entry → interaction rejected', () => {
    const edge = { ...baseEdge, trigger: { type: 'interaction' as const, action: 'submit' } };
    const err = validateEdgeTrigger(edge, 'entry');
    expect(err).not.toBeNull();
    expect(err?.reason).toContain('not valid for entry');
  });

  test('screen → interaction ok', () => {
    const edge = { ...baseEdge, trigger: { type: 'interaction' as const, action: 'submit' } };
    expect(validateEdgeTrigger(edge, 'screen')).toBeNull();
  });

  test('decision → branch ok', () => {
    const edge = { ...baseEdge, trigger: { type: 'branch' as const, value: true } };
    expect(validateEdgeTrigger(edge, 'decision')).toBeNull();
  });

  test('action → on-success / on-error ok; on-denied rejected', () => {
    expect(
      validateEdgeTrigger({ ...baseEdge, trigger: { type: 'on-success' } }, 'action'),
    ).toBeNull();
    expect(
      validateEdgeTrigger({ ...baseEdge, trigger: { type: 'on-error' } }, 'action'),
    ).toBeNull();
    const err = validateEdgeTrigger({ ...baseEdge, trigger: { type: 'on-denied' } }, 'action');
    expect(err).not.toBeNull();
  });

  test('external → on-denied / on-cancelled allowed', () => {
    expect(
      validateEdgeTrigger({ ...baseEdge, trigger: { type: 'on-denied' } }, 'external'),
    ).toBeNull();
    expect(
      validateEdgeTrigger({ ...baseEdge, trigger: { type: 'on-cancelled' } }, 'external'),
    ).toBeNull();
  });

  test('outcome rejects all outgoing edges (terminal)', () => {
    const edge = { ...baseEdge, trigger: { type: 'unconditional' as const } };
    const err = validateEdgeTrigger(edge, 'outcome');
    expect(err).not.toBeNull();
    expect(err?.reason).toContain('cannot have outgoing edges');
  });
});
