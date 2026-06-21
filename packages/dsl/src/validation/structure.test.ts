import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { checkStructure } from './structure.ts';

const minimalValidFlow = () =>
  FlowSchema.parse({
    id: 'f1',
    name: 'Minimal',
    nodes: [
      { type: 'entry', id: 'e1' },
      { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
    ],
    edges: [{ id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } }],
  });

describe('checkStructure — entry presence', () => {
  test('exactly one entry → no diagnostics', () => {
    const flow = minimalValidFlow();
    const codes = checkStructure(flow).map((d) => d.code);
    expect(codes).not.toContain('validation-entry-missing');
    expect(codes).not.toContain('validation-entry-multiple');
  });

  test('zero entries → entry-missing error', () => {
    const flow = FlowSchema.parse({ id: 'f1', name: 'X' });
    const d = checkStructure(flow);
    expect(d.some((x) => x.code === 'validation-entry-missing')).toBe(true);
  });

  test('two entries → entry-multiple errors (one per extra)', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Twins',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'entry', id: 'e2' },
      ],
    });
    const d = checkStructure(flow);
    expect(d.filter((x) => x.code === 'validation-entry-multiple').length).toBe(1);
  });
});

describe('checkStructure — reachability', () => {
  test('reachable graph → no unreachable diagnostics', () => {
    const flow = minimalValidFlow();
    const codes = checkStructure(flow).map((d) => d.code);
    expect(codes).not.toContain('validation-unreachable-node');
  });

  test('isolated node → unreachable error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Isolated',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'Orphan', kind: 'abandoned' },
      ],
      edges: [{ id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } }],
    });
    const d = checkStructure(flow);
    const unreachable = d.filter((x) => x.code === 'validation-unreachable-node');
    expect(unreachable.length).toBe(1);
    expect(unreachable[0]?.message).toContain('o2');
  });

  test('no entry → reachability check does not crash (entry-missing already flagged)', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' }],
    });
    const d = checkStructure(flow);
    expect(d.some((x) => x.code === 'validation-entry-missing')).toBe(true);
    expect(d.some((x) => x.code === 'validation-unreachable-node')).toBe(false);
  });
});

describe('checkStructure — terminability', () => {
  test('every path reaches an outcome → no diagnostics', () => {
    const flow = minimalValidFlow();
    const codes = checkStructure(flow).map((d) => d.code);
    expect(codes).not.toContain('validation-non-terminable-node');
  });

  test('infinite loop with no outcome → non-terminable errors', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Loop',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'screen', id: 's1', name: 'A', kind: 'password' },
        { type: 'screen', id: 's2', name: 'B', kind: 'password' },
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
          source: 's2',
          target: 's1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    const d = checkStructure(flow);
    const nonTerm = d.filter((x) => x.code === 'validation-non-terminable-node');
    // e1, s1, s2 all cannot reach any outcome.
    expect(nonTerm.length).toBe(3);
  });

  test('two-node cycle with escape to outcome → terminable (no diagnostics)', () => {
    // Self-loops fail schema parsing; we use a two-node cycle to test the
    // terminability check's cycle-with-escape logic.
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'Two-node cycle with escape',
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
          source: 's2',
          target: 's1',
          trigger: { type: 'interaction', action: 'back' },
        },
        {
          id: 'edge-4',
          source: 's2',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    const d = checkStructure(flow);
    expect(d.filter((x) => x.code === 'validation-non-terminable-node')).toEqual([]);
  });
});
