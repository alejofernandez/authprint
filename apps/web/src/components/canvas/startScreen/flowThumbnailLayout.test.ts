import { describe, expect, test } from 'bun:test';
import { emptyFlow } from '../emptyFlow.ts';
import { flowFromSource } from '../flowFromSource.ts';
import { edgeLine, layoutFlowThumbnail } from './flowThumbnailLayout.ts';

describe('layoutFlowThumbnail', () => {
  test('lays out a single entry node', () => {
    const layout = layoutFlowThumbnail(emptyFlow);
    expect(layout?.nodes).toHaveLength(1);
    expect(layout?.nodes[0]?.type).toBe('entry');
    expect(layout?.nodes[0]?.shape).toBe('circle');
    expect(layout?.edges).toHaveLength(0);
  });

  test('lays entry → screen → outcome left-to-right with connecting edges', () => {
    const layout = layoutFlowThumbnail({
      ...emptyFlow,
      nodes: [
        { type: 'entry', id: 'entry' },
        {
          type: 'screen',
          id: 's1',
          name: 'S',
          kind: 'identifier-collect',
          traits: [],
          fields: [],
          fidelity: 'lo-fi',
        },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'entry', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'e2',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    expect(layout?.nodes).toHaveLength(3);
    expect(layout?.edges).toHaveLength(2);

    const entry = layout?.nodes.find((node) => node.id === 'entry');
    const screen = layout?.nodes.find((node) => node.id === 's1');
    const outcome = layout?.nodes.find((node) => node.id === 'o1');
    if (!entry || !screen || !outcome || !layout) throw new Error('expected nodes');

    expect(entry.shape).toBe('circle');
    expect(screen.shape).toBe('screen');
    expect(screen.w / screen.h).toBeCloseTo(3 / 4, 1);
    expect(outcome.shape).toBe('pill');
    expect(entry.x).toBeLessThan(screen.x);
    expect(screen.x).toBeLessThan(outcome.x);

    const firstEdge = layout.edges[0];
    if (!firstEdge) throw new Error('expected edge');
    const line = edgeLine(layout, firstEdge);
    expect(line?.x1).toBeLessThan(line?.x2 ?? 0);
  });

  test('builds from parsed authprint source', () => {
    const source = `id: demo
name: Demo
nodes:
  - type: entry
    id: entry
  - type: screen
    id: s1
    name: S
    kind: identifier-collect
    traits: []
    fields: []
    fidelity: lo-fi
  - type: outcome
    id: o1
    name: Done
    kind: authenticated
edges:
  - id: e1
    source: entry
    target: s1
    trigger:
      type: unconditional
  - id: e2
    source: s1
    target: o1
    trigger:
      type: interaction
      action: submit
`;
    const { flow } = flowFromSource(source);
    if (!flow) throw new Error('expected flow');
    const layout = layoutFlowThumbnail(flow);
    expect(layout?.nodes.length).toBe(3);
  });

  test('lays decision nodes as diamonds with canvas aspect ratio', () => {
    const layout = layoutFlowThumbnail({
      ...emptyFlow,
      nodes: [
        { type: 'entry', id: 'entry' },
        {
          type: 'decision',
          id: 'd1',
          name: 'Check',
          kind: 'user-exists',
          predicate: { slot: 'user.exists', op: 'equals', value: true },
        },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'entry', target: 'd1', trigger: { type: 'unconditional' } },
        {
          id: 'e2',
          source: 'd1',
          target: 'o1',
          trigger: { type: 'branch', value: true },
        },
      ],
    });
    const decision = layout?.nodes.find((node) => node.id === 'd1');
    expect(decision?.shape).toBe('diamond');
    if (!decision) throw new Error('expected decision');
    expect(decision.w / decision.h).toBeCloseTo(180 / 112, 1);
  });
});
