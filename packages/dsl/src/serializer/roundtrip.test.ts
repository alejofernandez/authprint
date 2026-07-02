import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser/index.ts';
import { type Flow, FlowSchema } from '../schema/flow.ts';
import { serialize } from './index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function reparse(flow: Flow): Flow {
  const text = serialize(flow);
  const result = parse(text);
  if (!result.flow) {
    throw new Error(
      `re-parse failed: ${result.diagnostics.map((d) => `${d.code}: ${d.message}`).join('; ')}`,
    );
  }
  return result.flow;
}

describe('round-trip — hand-built flows', () => {
  test('minimal flow with just an entry round-trips', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Minimal',
      nodes: [{ type: 'entry', id: 'e1' }],
    });
    expect(reparse(flow)).toEqual(flow);
  });

  test('flow with every structural node type round-trips', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'All structural types',
      context: { 'risk.score': { type: 'number' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'screen',
          id: 's1',
          name: 'Sign in',
          kind: 'password',
          traits: ['captcha', 'remember-me'],
          fields: [
            { name: 'identifier', type: 'identifier', required: true },
            { name: 'password', type: 'password', required: true },
          ],
          fidelity: 'wireframe',
        },
        {
          type: 'decision',
          id: 'd1',
          name: 'High risk?',
          kind: 'risk-elevated',
          predicate: { slot: 'risk.score', op: 'greater-than', value: 50 },
        },
        { type: 'action', id: 'a1', name: 'Send OTP', kind: 'send-otp' },
        { type: 'external', id: 'x1', name: 'Google', kind: 'google' },
        { type: 'outcome', id: 'o1', name: 'Authenticated', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'edge-2',
          source: 's1',
          target: 'd1',
          label: 'on submit',
          trigger: { type: 'interaction', action: 'submit' },
        },
        { id: 'edge-3', source: 'd1', target: 'a1', trigger: { type: 'branch', value: true } },
        { id: 'edge-4', source: 'd1', target: 'x1', trigger: { type: 'branch', value: false } },
        { id: 'edge-5', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
        { id: 'edge-6', source: 'a1', target: 'o1', trigger: { type: 'on-error' } },
        { id: 'edge-7', source: 'x1', target: 'o1', trigger: { type: 'on-success' } },
        { id: 'edge-8', source: 'x1', target: 'o1', trigger: { type: 'on-denied' } },
        { id: 'edge-9', source: 'x1', target: 'o1', trigger: { type: 'on-cancelled' } },
      ],
    });
    expect(reparse(flow)).toEqual(flow);
  });

  test('flow with all annotation attachment types round-trips', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Annotations',
      nodes: [{ type: 'entry', id: 'e1' }],
      annotations: [
        { id: 'a1', kind: 'note', text: 'on node', attachment: { type: 'node', nodeId: 'e1' } },
        {
          id: 'a2',
          kind: 'rationale',
          text: 'on edge',
          attachment: { type: 'edge', edgeId: 'edge-x' },
        },
        {
          id: 'a3',
          kind: 'note',
          text: 'floating',
          attachment: { type: 'floating', x: 100, y: 200 },
        },
      ],
    });
    expect(reparse(flow)).toEqual(flow);
  });

  test('flow with scenarios round-trips', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'With scenarios',
      context: { 'user.has_passkey': { type: 'boolean' } },
      nodes: [{ type: 'entry', id: 'e1' }],
      scenarios: [
        {
          id: 'sc1',
          name: 'happy path',
          description: 'the basic case',
          initialContext: { 'user.has_passkey': true },
          inputScript: [
            { type: 'screen', nodeId: 's1', action: 'submit' },
            { type: 'action', nodeId: 'a1', result: 'success' },
            { type: 'external', nodeId: 'x1', result: 'denied' },
          ],
          expectedOutcome: { outcomeId: 'o1', sequence: ['s1', 'a1', 'o1'] },
        },
      ],
    });
    expect(reparse(flow)).toEqual(flow);
  });

  test('all theme values round-trip', () => {
    for (const theme of ['light', 'dark', 'both'] as const) {
      const flow = FlowSchema.parse({
        id: 'f1',
        name: 'X',
        branding: { theme },
        nodes: [{ type: 'entry', id: 'e1' }],
      });
      expect(reparse(flow).branding.theme).toBe(theme);
    }
  });

  test('branding round-trips, and the key is omitted entirely when at defaults', () => {
    const branded = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      branding: { theme: 'dark', companyName: 'Acme', primaryColor: '#4f46e5' },
      nodes: [{ type: 'entry', id: 'e1' }],
    });
    expect(reparse(branded).branding).toEqual({
      theme: 'dark',
      companyName: 'Acme',
      primaryColor: '#4f46e5',
    });

    const unbranded = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
    });
    expect(serialize(unbranded)).not.toContain('branding');
    expect(reparse(unbranded).branding).toEqual({ theme: 'light' });
  });

  test('all predicate operators round-trip', () => {
    for (const op of [
      'equals',
      'not-equals',
      'greater-than',
      'less-than',
      'greater-than-or-equal',
      'less-than-or-equal',
      'in',
      'not-in',
    ] as const) {
      const flow = FlowSchema.parse({
        id: 'f1',
        name: 'X',
        context: { 'x.y': { type: 'number' } },
        nodes: [
          { type: 'entry', id: 'e1' },
          {
            type: 'decision',
            id: 'd1',
            kind: 'risk-elevated',
            predicate: { slot: 'x.y', op, value: 10 },
          },
        ],
      });
      expect(reparse(flow)).toEqual(flow);
    }
  });

  test('all context slot types round-trip', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: {
        'a.bool': { type: 'boolean' },
        'a.num': { type: 'number' },
        'a.str': { type: 'string' },
        'a.enum': { type: 'enum', values: ['x', 'y', 'z'] },
      },
      nodes: [{ type: 'entry', id: 'e1' }],
    });
    expect(reparse(flow)).toEqual(flow);
  });
});

describe('round-trip — example files', () => {
  for (const filename of [
    'passkey-enrollment.authprint',
    'magic-link-signin.authprint',
    'demo-flow-zero.authprint',
  ]) {
    test(`${filename} round-trips`, () => {
      const text = readFileSync(`${here}/../../../dsl-spec/examples/${filename}`, 'utf8');
      const first = parse(text);
      const errors = first.diagnostics.filter((d) => d.severity === 'error');
      expect(errors).toEqual([]);
      expect(first.flow).not.toBeNull();
      if (!first.flow) return;
      const reparsed = reparse(first.flow);
      expect(reparsed).toEqual(first.flow);
    });
  }
});

describe('round-trip — idempotency (byte-stable emit)', () => {
  test('serialize(parse(serialize(flow))) === serialize(flow) for hand-built flow', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Idempotent',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [{ id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } }],
    });
    const text1 = serialize(flow);
    const reparsed = parse(text1);
    expect(reparsed.flow).not.toBeNull();
    if (!reparsed.flow) return;
    const text2 = serialize(reparsed.flow);
    expect(text2).toBe(text1);
  });

  test('serialize(parse(...)) is stable for the example file across two cycles', () => {
    const original = readFileSync(
      `${here}/../../../dsl-spec/examples/passkey-enrollment.authprint`,
      'utf8',
    );
    const parsed1 = parse(original);
    expect(parsed1.flow).not.toBeNull();
    if (!parsed1.flow) return;
    const text1 = serialize(parsed1.flow);
    const parsed2 = parse(text1);
    expect(parsed2.flow).not.toBeNull();
    if (!parsed2.flow) return;
    const text2 = serialize(parsed2.flow);
    expect(text2).toBe(text1);
  });
});
