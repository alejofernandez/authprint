import { describe, expect, test } from 'bun:test';
import type { ContextSlot, Node as DslNode, Edge } from '@authprint/dsl';
import type * as Y from 'yjs';
import {
  buildContextSlotMap,
  buildEdgeMap,
  buildNodeMap,
  contextMap,
  createDoc,
  edgeLayoutMap,
  edgesMap,
  layoutMap,
  metaMap,
  nodesMap,
  readContextSlotMap,
  readEdgeMap,
  readNodeMap,
} from './schema.ts';

// Y types only serve `.get()` once integrated into a doc; the build helpers are
// always inserted into a doc map in production (see hydrate). These round-trip
// helpers mirror that: insert, then read back.
function roundTripNode(node: DslNode): DslNode {
  const doc = createDoc();
  nodesMap(doc).set(node.id, buildNodeMap(node));
  return readNodeMap(nodesMap(doc).get(node.id) as Y.Map<unknown>);
}
function roundTripEdge(edge: Edge): Edge {
  const doc = createDoc();
  edgesMap(doc).set(edge.id, buildEdgeMap(edge));
  return readEdgeMap(edgesMap(doc).get(edge.id) as Y.Map<unknown>);
}
function roundTripSlot(slot: ContextSlot): ContextSlot {
  const doc = createDoc();
  contextMap(doc).set('s', buildContextSlotMap(slot));
  return readContextSlotMap(contextMap(doc).get('s') as Y.Map<unknown>);
}

describe('createDoc', () => {
  test('a fresh doc has the five maps plus meta, all empty', () => {
    const doc = createDoc();
    for (const map of [nodesMap, edgesMap, contextMap, layoutMap, edgeLayoutMap, metaMap]) {
      expect(map(doc).size).toBe(0);
    }
  });
});

describe('node round-trip', () => {
  const cases: DslNode[] = [
    { type: 'entry', id: 'entry' },
    {
      type: 'screen',
      id: 's1',
      name: 'Sign in',
      kind: 'password',
      traits: ['captcha', 'remember-me'],
      fields: [
        { name: 'identifier', type: 'identifier', required: true },
        { name: 'password', type: 'password', required: false },
      ],
      fidelity: 'wireframe',
    },
    {
      type: 'decision',
      id: 'd1',
      name: 'MFA?',
      kind: 'mfa-required',
      predicate: { slot: 'risk.score', op: 'greater-than', value: 50 },
    },
    {
      type: 'decision',
      id: 'd2',
      kind: 'user-exists',
      predicate: { slot: 'u', op: 'equals', value: true },
    },
    { type: 'action', id: 'a1', name: 'Send code', kind: 'send-otp' },
    { type: 'external', id: 'x1', name: 'Google', kind: 'google' },
    { type: 'outcome', id: 'o1', name: 'Authenticated', kind: 'authenticated' },
  ];

  for (const node of cases) {
    test(`${node.type} (${node.id})`, () => {
      expect(roundTripNode(node)).toEqual(node);
    });
  }

  test('decision without a name omits the key (stays undefined, not null)', () => {
    const read = roundTripNode({
      type: 'decision',
      id: 'd',
      kind: 'k',
      predicate: { slot: 's', op: 'equals', value: 1 },
    });
    expect('name' in read && read.name).toBeUndefined();
  });

  test('empty traits/fields survive as empty arrays', () => {
    const read = roundTripNode({
      type: 'screen',
      id: 's',
      name: 'n',
      kind: 'k',
      traits: [],
      fields: [],
      fidelity: 'lo-fi',
    }) as Extract<DslNode, { type: 'screen' }>;
    expect(read.traits).toEqual([]);
    expect(read.fields).toEqual([]);
  });
});

describe('edge round-trip', () => {
  const cases: Edge[] = [
    { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
    { id: 'e2', source: 's1', target: 'd1', trigger: { type: 'interaction', action: 'submit' } },
    { id: 'e3', source: 'd1', target: 'a1', trigger: { type: 'branch', value: true } },
    { id: 'e4', source: 'd1', target: 'o1', trigger: { type: 'branch', value: false } },
    { id: 'e5', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
    { id: 'e6', source: 'a1', target: 'o2', trigger: { type: 'on-error' }, label: 'failed' },
    { id: 'e7', source: 'x1', target: 'o3', trigger: { type: 'on-cancelled' } },
  ];

  for (const edge of cases) {
    test(`${edge.trigger.type} (${edge.id})`, () => {
      expect(roundTripEdge(edge)).toEqual(edge);
    });
  }
});

describe('context slot round-trip', () => {
  test('boolean slot', () => {
    expect(roundTripSlot({ type: 'boolean' })).toEqual({ type: 'boolean' });
  });
  test('enum slot preserves values', () => {
    const slot: ContextSlot = { type: 'enum', values: ['low', 'high'] };
    expect(roundTripSlot(slot)).toEqual(slot);
  });
});
