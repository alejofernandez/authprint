import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import { buildNodeAriaLabel } from './nodeAriaLabel.ts';

const flow: Flow = {
  id: 'f',
  name: 'X',
  theme: 'light',
  context: {},
  nodes: [
    { type: 'entry', id: 'e1' },
    {
      type: 'screen',
      id: 's-password',
      name: 'Password',
      kind: 'password',
      traits: [],
      fields: [],
      fidelity: 'lo-fi',
    },
    {
      type: 'decision',
      id: 'd-mfa',
      name: 'MFA required?',
      kind: 'mfa-required',
      predicate: { slot: 'mfa.required', op: 'equals', value: true },
    },
    { type: 'outcome', id: 'o1', name: 'Authenticated', kind: 'authenticated' },
  ],
  edges: [
    { id: 'e-entry', source: 'e1', target: 's-password', trigger: { type: 'unconditional' } },
    {
      id: 'e-submit',
      source: 's-password',
      target: 'd-mfa',
      trigger: { type: 'interaction', action: 'submit' },
    },
  ],
  annotations: [],
  scenarios: [],
};

describe('buildNodeAriaLabel', () => {
  test('screen node includes type, name, kind, and connection summary', () => {
    expect(buildNodeAriaLabel(flow, 's-password')).toBe(
      'Screen node: Password (password). Connected to MFA required? via submit',
    );
  });

  test('entry node omits kind suffix', () => {
    expect(buildNodeAriaLabel(flow, 'e1')).toBe('Entry node: e1');
  });

  test('unknown node id falls back', () => {
    expect(buildNodeAriaLabel(flow, 'missing')).toBe('Flow node');
  });
});
