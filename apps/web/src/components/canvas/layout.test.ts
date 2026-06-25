import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import type { NodePositionsMap } from './flowToReactFlow.ts';

// elkjs's bundled build only exports its in-process `Worker` constructor when
// it believes it is NOT running inside a Web Worker — and it decides that by
// checking for a global `self`. Bun defines `self`, so elkjs takes the
// worker-context branch and `new ELK()` blows up. The browser (where this
// code actually runs) has no such issue. Drop the global before importing the
// module under test, which constructs ELK at load time.
delete (globalThis as { self?: unknown }).self;

const { layoutFlow } = await import('./layout.ts');
const { nodeSize } = await import('./flowToReactFlow.ts');
const { sampleFlow } = await import('./sampleFlow.ts');

// Fetch a position, asserting it exists — narrows away `undefined` (the map is
// indexed under `noUncheckedIndexedAccess`) and doubles as a presence check.
function at(positions: NodePositionsMap, id: string): { x: number; y: number } {
  const pos = positions[id];
  if (!pos) throw new Error(`expected a position for node "${id}"`);
  return pos;
}

describe('layoutFlow', () => {
  test('produces a finite position for every node in the sample flow', async () => {
    const positions = await layoutFlow(sampleFlow);

    expect(Object.keys(positions).sort()).toEqual(sampleFlow.nodes.map((n) => n.id).sort());

    for (const node of sampleFlow.nodes) {
      const pos = at(positions, node.id);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
  });

  test('lays the LR flow out left-to-right (entry left of its successors)', async () => {
    const positions = await layoutFlow(sampleFlow);
    // Entry feeds the screen; with direction RIGHT it must sit to its left.
    expect(at(positions, 'e1').x).toBeLessThan(at(positions, 's1').x);
    // Terminal outcomes sit to the right of the entry.
    expect(at(positions, 'o-authenticated-otp').x).toBeGreaterThan(at(positions, 'e1').x);
  });

  test('spaces mockup-fidelity screens by their larger box (no overlap)', async () => {
    // Two sibling screens off a decision land in the same layer (same x),
    // stacked vertically. With mockup fidelity they get the larger size hint
    // (E39/US-067), so ELK must separate them by at least the card height.
    const mockupHeight = nodeSize({
      type: 'screen',
      id: 'probe',
      name: 'probe',
      kind: 'password',
      traits: [],
      fields: [],
      fidelity: 'mockup',
    }).height;

    const flow: Flow = {
      ...sampleFlow,
      context: { 'user.x': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e' },
        {
          type: 'decision',
          id: 'd',
          name: 'D',
          kind: 'user-exists',
          predicate: { slot: 'user.x', op: 'equals', value: true },
        },
        {
          type: 'screen',
          id: 'sa',
          name: 'A',
          kind: 'password',
          traits: [],
          fields: [],
          fidelity: 'mockup',
        },
        {
          type: 'screen',
          id: 'sb',
          name: 'B',
          kind: 'password',
          traits: [],
          fields: [],
          fidelity: 'mockup',
        },
      ],
      edges: [
        { id: 'g1', source: 'e', target: 'd', trigger: { type: 'unconditional' } },
        { id: 'g2', source: 'd', target: 'sa', trigger: { type: 'branch', value: true } },
        { id: 'g3', source: 'd', target: 'sb', trigger: { type: 'branch', value: false } },
      ],
    };

    const positions = await layoutFlow(flow);
    const a = at(positions, 'sa');
    const b = at(positions, 'sb');
    expect(Math.abs(a.y - b.y)).toBeGreaterThanOrEqual(mockupHeight);
  });

  test('returns an empty map for an empty flow (no elkjs call)', async () => {
    const empty: Flow = { ...sampleFlow, nodes: [], edges: [] };
    expect(await layoutFlow(empty)).toEqual({});
  });

  test('lays out disconnected subgraphs without dropping nodes or collapsing positions', async () => {
    // Two independent entry→outcome chains with no edge between them.
    const disconnected: Flow = {
      ...sampleFlow,
      context: {},
      nodes: [
        { type: 'entry', id: 'eA' },
        { type: 'outcome', id: 'oA', name: 'Done A', kind: 'authenticated' },
        { type: 'entry', id: 'eB' },
        { type: 'outcome', id: 'oB', name: 'Done B', kind: 'authenticated' },
      ],
      edges: [
        { id: 'eg-a', source: 'eA', target: 'oA', trigger: { type: 'unconditional' } },
        { id: 'eg-b', source: 'eB', target: 'oB', trigger: { type: 'unconditional' } },
      ],
    };

    const positions = await layoutFlow(disconnected);

    expect(Object.keys(positions).sort()).toEqual(['eA', 'eB', 'oA', 'oB']);
    for (const id of ['eA', 'eB', 'oA', 'oB']) {
      const pos = at(positions, id);
      expect(Number.isFinite(pos.x)).toBe(true);
      expect(Number.isFinite(pos.y)).toBe(true);
    }
    // The two chains must not be stacked on top of each other.
    const a = at(positions, 'eA');
    const b = at(positions, 'eB');
    expect(`${a.x},${a.y}`).not.toBe(`${b.x},${b.y}`);
  });
});
