import { describe, expect, test } from 'bun:test';
import { join } from 'node:path';
import { type Flow, parse } from '@authprint/dsl';
import { emptyFlow } from '../emptyFlow.ts';
import { hydrate, readFlow } from './hydrate.ts';
import { layoutMap } from './schema.ts';

// Resolve relative to this file so the test passes regardless of cwd.
const DEMO_PATH = join(
  import.meta.dir,
  '../../../../../../packages/dsl-spec/examples/demo-flow-zero.authprint',
);

async function loadDemoFlowZero(): Promise<Flow> {
  const source = await Bun.file(DEMO_PATH).text();
  const { flow, diagnostics } = parse(source);
  if (!flow) throw new Error(`Demo Flow Zero failed to parse: ${JSON.stringify(diagnostics)}`);
  return flow;
}

const sampleFlow: Flow = {
  id: 'sample',
  name: 'Sample',
  description: 'a tiny flow',
  branding: { theme: 'dark', companyName: 'Acme', primaryColor: '#4f46e5' },
  context: {
    'user.exists': { type: 'boolean' },
    'risk.level': { type: 'enum', values: ['low', 'high'] },
  },
  nodes: [
    { type: 'entry', id: 'entry' },
    {
      type: 'screen',
      id: 's1',
      name: 'Email',
      kind: 'identifier-collect',
      traits: ['captcha'],
      fields: [{ name: 'email', type: 'identifier', required: true }],
      fidelity: 'lo-fi',
    },
    {
      type: 'decision',
      id: 'd1',
      kind: 'user-exists',
      predicate: { slot: 'user.exists', op: 'equals', value: true },
    },
    { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
  ],
  edges: [
    { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
    { id: 'e2', source: 's1', target: 'd1', trigger: { type: 'interaction', action: 'submit' } },
    { id: 'e3', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
    { id: 'e4', source: 'd1', target: 'o1', trigger: { type: 'branch', value: false } },
  ],
  annotations: [{ id: 'a1', kind: 'note', text: 'hi', attachment: { type: 'node', nodeId: 's1' } }],
  scenarios: [],
};

describe('hydrate → readFlow', () => {
  test('a hydrated sample flow reads back equal (order-independent)', () => {
    const out = readFlow(hydrate(sampleFlow));

    expect(out.id).toBe(sampleFlow.id);
    expect(out.name).toBe(sampleFlow.name);
    expect(out.description).toBe(sampleFlow.description);
    expect(out.branding).toEqual(sampleFlow.branding);
    expect(out.context).toEqual(sampleFlow.context);
    expect(out.annotations).toEqual(sampleFlow.annotations);
    expect(out.scenarios).toEqual(sampleFlow.scenarios);

    // Y.Map iteration is not guaranteed insertion-ordered — compare as sets.
    const byId = <T extends { id: string }>(xs: T[]) => new Map(xs.map((x) => [x.id, x]));
    expect(byId(out.nodes)).toEqual(byId(sampleFlow.nodes));
    expect(byId(out.edges)).toEqual(byId(sampleFlow.edges));
  });

  test('layout map is empty after hydrate (fresh canvas persists no positions)', () => {
    expect(layoutMap(hydrate(sampleFlow)).size).toBe(0);
  });

  test('emptyFlow (entry only) hydrates and reads back', () => {
    const out = readFlow(hydrate(emptyFlow));
    expect(out).toEqual(emptyFlow);
  });

  test('description key absent when the flow has none', () => {
    const out = readFlow(hydrate({ ...sampleFlow, description: undefined }));
    expect('description' in out).toBe(false);
  });

  test('branding defaults to just theme when the flow declares none', () => {
    const out = readFlow(hydrate({ ...sampleFlow, branding: { theme: 'light' } }));
    expect(out.branding).toEqual({ theme: 'light' });
  });

  test('Demo Flow Zero hydrates and reads back with all entities intact', async () => {
    const demo = await loadDemoFlowZero();
    const out = readFlow(hydrate(demo));

    expect(out.nodes).toHaveLength(demo.nodes.length);
    expect(out.edges).toHaveLength(demo.edges.length);
    expect(out.annotations).toHaveLength(demo.annotations.length);
    expect(out.scenarios).toHaveLength(demo.scenarios.length);

    expect(new Set(out.nodes.map((n) => n.id))).toEqual(new Set(demo.nodes.map((n) => n.id)));
    expect(new Set(out.edges.map((e) => e.id))).toEqual(new Set(demo.edges.map((e) => e.id)));
    expect(out.context).toEqual(demo.context);
  });
});
