import { describe, expect, test } from 'bun:test';
import {
  ActionNodeSchema,
  DecisionNodeSchema,
  EntryNodeSchema,
  ExternalNodeSchema,
  NodeSchema,
  OutcomeNodeSchema,
  ScreenNodeSchema,
} from './node.ts';

describe('Node schemas', () => {
  test('EntryNode parses minimal entry', () => {
    const r = EntryNodeSchema.safeParse({ type: 'entry', id: 'e1' });
    expect(r.success).toBe(true);
  });

  test('ScreenNode parses screen with all required fields', () => {
    const r = ScreenNodeSchema.safeParse({
      type: 'screen',
      id: 's1',
      name: 'Sign in',
      kind: 'password',
      traits: ['captcha', 'remember-me'],
      fields: [
        { name: 'identifier', type: 'identifier', required: true },
        { name: 'password', type: 'password', required: true },
      ],
      fidelity: 'lo-fi',
    });
    expect(r.success).toBe(true);
  });

  test('ScreenNode rejects unknown trait', () => {
    const r = ScreenNodeSchema.safeParse({
      type: 'screen',
      id: 's1',
      name: 'Sign in',
      kind: 'password',
      traits: ['this-trait-does-not-exist'],
      fields: [],
      fidelity: 'lo-fi',
    });
    expect(r.success).toBe(false);
  });

  test('ScreenNode accepts custom kind value', () => {
    const r = ScreenNodeSchema.safeParse({
      type: 'screen',
      id: 's1',
      name: 'Bespoke screen',
      kind: 'totally-bespoke-kind',
      traits: [],
      fields: [],
      fidelity: 'lo-fi',
    });
    // Kind is z.string() — validator layer (later) warns; schema accepts.
    expect(r.success).toBe(true);
  });

  test('DecisionNode parses with predicate, name optional', () => {
    const r = DecisionNodeSchema.safeParse({
      type: 'decision',
      id: 'd1',
      kind: 'mfa-required',
      predicate: { slot: 'risk.score', op: 'greater-than', value: 50 },
    });
    expect(r.success).toBe(true);
  });

  test('ActionNode parses', () => {
    const r = ActionNodeSchema.safeParse({
      type: 'action',
      id: 'a1',
      name: 'Validate credentials',
      kind: 'validate-credentials',
    });
    expect(r.success).toBe(true);
  });

  test('ExternalNode parses', () => {
    const r = ExternalNodeSchema.safeParse({
      type: 'external',
      id: 'x1',
      name: 'Sign in with Google',
      kind: 'google',
    });
    expect(r.success).toBe(true);
  });

  test('OutcomeNode parses', () => {
    const r = OutcomeNodeSchema.safeParse({
      type: 'outcome',
      id: 'o1',
      name: 'Authenticated',
      kind: 'authenticated',
    });
    expect(r.success).toBe(true);
  });

  test('NodeSchema discriminates on type', () => {
    const screen = NodeSchema.safeParse({
      type: 'screen',
      id: 's1',
      name: 'X',
      kind: 'password',
      traits: [],
      fields: [],
      fidelity: 'lo-fi',
    });
    expect(screen.success).toBe(true);
    if (screen.success) {
      // Type narrowing works at the consumer site
      expect(screen.data.type).toBe('screen');
    }

    const decision = NodeSchema.safeParse({
      type: 'decision',
      id: 'd1',
      kind: 'user-exists',
      predicate: { slot: 'foo', op: 'equals', value: true },
    });
    expect(decision.success).toBe(true);
  });

  test('NodeSchema rejects unknown type discriminator', () => {
    const r = NodeSchema.safeParse({ type: 'nonsense', id: 'x' });
    expect(r.success).toBe(false);
  });
});
