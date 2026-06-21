import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { checkReferences } from './references.ts';

describe('checkReferences — edges', () => {
  test('valid references → no diagnostics', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
      ],
      edges: [{ id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } }],
    });
    expect(checkReferences(flow)).toEqual([]);
  });

  test('edge target not found → target-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'nonexistent', trigger: { type: 'unconditional' } },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-edge-target-not-found');
  });

  test('edge source not found → source-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' }],
      edges: [
        { id: 'edge-1', source: 'nonexistent', target: 'o1', trigger: { type: 'unconditional' } },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-edge-source-not-found');
  });
});

describe('checkReferences — annotations', () => {
  test('annotation pointing at a missing node → node-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
      annotations: [
        {
          id: 'a1',
          kind: 'note',
          text: 'orphan',
          attachment: { type: 'node', nodeId: 'ghost' },
        },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-annotation-node-not-found');
  });

  test('annotation pointing at a missing edge → edge-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
      annotations: [
        {
          id: 'a1',
          kind: 'note',
          text: 'orphan',
          attachment: { type: 'edge', edgeId: 'ghost-edge' },
        },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-annotation-edge-not-found');
  });

  test('floating annotations skip reference check', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
      annotations: [
        {
          id: 'a1',
          kind: 'note',
          text: 'free',
          attachment: { type: 'floating', x: 10, y: 20 },
        },
      ],
    });
    expect(checkReferences(flow)).toEqual([]);
  });
});

describe('checkReferences — scenarios', () => {
  test('scenario step type mismatch → type-mismatch error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'screen', id: 's1', name: 'A', kind: 'password' },
      ],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: {},
          // Step says action but the node is a screen — mismatch.
          inputScript: [{ type: 'action', nodeId: 's1', result: 'success' }],
        },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-scenario-step-type-mismatch');
  });

  test('scenario step node not found → step-node-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [{ type: 'entry', id: 'e1' }],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: {},
          inputScript: [{ type: 'screen', nodeId: 'missing', action: 'submit' }],
        },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-scenario-step-node-not-found');
  });

  test('expectedOutcome.outcomeId pointing at a non-outcome → outcome-not-found error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'screen', id: 's1', name: 'A', kind: 'password' },
      ],
      scenarios: [
        {
          id: 'sc1',
          name: 'X',
          initialContext: {},
          inputScript: [],
          expectedOutcome: { outcomeId: 's1' }, // s1 is a screen, not an outcome
        },
      ],
    });
    const codes = checkReferences(flow).map((d) => d.code);
    expect(codes).toContain('validation-scenario-outcome-not-found');
  });
});
