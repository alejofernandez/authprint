import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { checkRedundantLinkTraits } from './redundancy.ts';

const flowWith = (traits: string[], actions: string[]) =>
  FlowSchema.parse({
    id: 'f1',
    name: 'F',
    nodes: [
      { type: 'entry', id: 'e1' },
      { type: 'screen', id: 's1', name: 'Sign in', kind: 'password', traits },
      { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
    ],
    edges: [
      { id: 'edge-in', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
      ...actions.map((action, i) => ({
        id: `edge-${i}`,
        source: 's1',
        target: 'o1',
        trigger: { type: 'interaction' as const, action },
      })),
    ],
  });

describe('checkRedundantLinkTraits', () => {
  test('flags a link trait whose action is also modelled', () => {
    const out = checkRedundantLinkTraits(
      flowWith(['alternative-method-link'], ['submit', 'try-another-method']),
    );
    expect(out).toHaveLength(1);
    expect(out[0]?.code).toBe('validation-redundant-link-trait');
    // A tidy-up, not a defect: the flow runs fine either way.
    expect(out[0]?.severity).toBe('info');
    expect(out[0]?.target).toEqual({ kind: 'node', id: 's1' });
    expect(out[0]?.path).toBe('nodes[1].traits[0]');
  });

  test('silent when only the trait is present (the deliberate stub case)', () => {
    expect(checkRedundantLinkTraits(flowWith(['alternative-method-link'], ['submit']))).toEqual([]);
  });

  test('silent when only the action is present', () => {
    expect(checkRedundantLinkTraits(flowWith([], ['try-another-method']))).toEqual([]);
  });

  test('pairs forgot-password-link with forgot-password', () => {
    const out = checkRedundantLinkTraits(flowWith(['forgot-password-link'], ['forgot-password']));
    expect(out).toHaveLength(1);
    expect(out[0]?.message).toContain('forgot-password');
  });

  test('ignores traits that stand for no action', () => {
    expect(checkRedundantLinkTraits(flowWith(['captcha', 'remember-me'], ['submit']))).toEqual([]);
  });

  // social-login-buttons overlaps with the per-provider actions but is 1:N and
  // renders differently, so it is deliberately not reconciled (UF-038).
  test('does not flag social-login-buttons against a google action', () => {
    expect(checkRedundantLinkTraits(flowWith(['social-login-buttons'], ['google']))).toEqual([]);
  });
});
