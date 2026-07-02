import { describe, expect, test } from 'bun:test';
import { AnnotationSchema } from './annotation.ts';
import { FlowSchema } from './flow.ts';
import { ContextSlotSchema } from './predicate.ts';
import { ScenarioSchema } from './scenario.ts';
import { VersionSchema } from './version.ts';

describe('ContextSlot', () => {
  test('boolean slot parses', () => {
    expect(ContextSlotSchema.safeParse({ type: 'boolean' }).success).toBe(true);
  });

  test('enum slot requires non-empty values', () => {
    const ok = ContextSlotSchema.safeParse({ type: 'enum', values: ['a', 'b'] });
    expect(ok.success).toBe(true);

    const empty = ContextSlotSchema.safeParse({ type: 'enum', values: [] });
    expect(empty.success).toBe(false);

    const missing = ContextSlotSchema.safeParse({ type: 'enum' });
    expect(missing.success).toBe(false);
  });
});

describe('Annotation', () => {
  test('note attached to node parses', () => {
    const r = AnnotationSchema.safeParse({
      id: 'a1',
      kind: 'note',
      text: 'this is a sticky note',
      attachment: { type: 'node', nodeId: 'screen-1' },
    });
    expect(r.success).toBe(true);
  });

  test('rationale floating parses', () => {
    const r = AnnotationSchema.safeParse({
      id: 'a1',
      kind: 'rationale',
      text: 'we decided this because...',
      attachment: { type: 'floating', x: 100, y: 200 },
    });
    expect(r.success).toBe(true);
  });

  test('unknown kind rejected', () => {
    const r = AnnotationSchema.safeParse({
      id: 'a1',
      kind: 'unknown-kind',
      text: 'x',
      attachment: { type: 'node', nodeId: 'n' },
    });
    expect(r.success).toBe(false);
  });
});

describe('Version', () => {
  test('valid version metadata parses', () => {
    const r = VersionSchema.safeParse({
      id: 'v1',
      name: 'v1.0 — passkey rollout',
      type: 'named',
      createdAt: '2026-06-21T17:00:00.000Z',
      createdBy: 'user-123',
    });
    expect(r.success).toBe(true);
  });

  test('rejects bad timestamp', () => {
    const r = VersionSchema.safeParse({
      id: 'v1',
      name: 'x',
      type: 'auto',
      createdAt: 'yesterday',
      createdBy: 'u1',
    });
    expect(r.success).toBe(false);
  });
});

describe('Scenario', () => {
  test('scenario with full script parses', () => {
    const r = ScenarioSchema.safeParse({
      id: 'sc1',
      name: 'Happy path: existing user with passkey',
      initialContext: { 'user.has_passkey': true, 'risk.score': 5 },
      inputScript: [
        { type: 'screen', nodeId: 's1', action: 'submit' },
        { type: 'action', nodeId: 'a1', result: 'success' },
        { type: 'external', nodeId: 'x1', result: 'success' },
      ],
      expectedOutcome: { outcomeId: 'o-authenticated' },
    });
    expect(r.success).toBe(true);
  });

  test('scenario with no expected outcome parses (run only, no assertion)', () => {
    const r = ScenarioSchema.safeParse({
      id: 'sc1',
      name: 'Walk-through',
      initialContext: {},
      inputScript: [],
    });
    expect(r.success).toBe(true);
  });
});

describe('Flow', () => {
  test('minimal flow parses with defaults applied', () => {
    const r = FlowSchema.safeParse({
      id: 'f1',
      name: 'Sample',
    });
    expect(r.success).toBe(true);
    if (r.success) {
      expect(r.data.branding).toEqual({ theme: 'light' });
      expect(r.data.context).toEqual({});
      expect(r.data.nodes).toEqual([]);
      expect(r.data.edges).toEqual([]);
    }
  });

  test('branding: theme always resolves; companyName/primaryColor are independently optional', () => {
    const withAll = FlowSchema.safeParse({
      id: 'f1',
      name: 'Sample',
      branding: { theme: 'dark', companyName: 'Acme', primaryColor: '#4f46e5' },
    });
    expect(withAll.success).toBe(true);

    const withCompanyOnly = FlowSchema.safeParse({
      id: 'f1',
      name: 'Sample',
      branding: { companyName: 'Acme' },
    });
    expect(withCompanyOnly.success).toBe(true);
    if (withCompanyOnly.success) {
      expect(withCompanyOnly.data.branding.theme).toBe('light');
    }
  });

  test('flow with one entry + one outcome + one edge parses end-to-end', () => {
    const r = FlowSchema.safeParse({
      id: 'f1',
      name: 'Passkey signup',
      branding: { theme: 'dark' },
      context: {},
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'outcome',
          id: 'o1',
          name: 'Authenticated',
          kind: 'authenticated',
        },
      ],
      edges: [{ id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } }],
      annotations: [],
      scenarios: [],
    });
    expect(r.success).toBe(true);
  });
});
