// US-055 — diagnostics carry a structural `target` (node/edge id) so id-keyed
// consumers (the canvas overlay) can ring the offending element directly.

import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '../schema/flow.ts';
import { validate } from './index.ts';

const find = (flow: ReturnType<typeof FlowSchema.parse>, code: string) =>
  validate(flow).find((d) => d.code === code);

describe('diagnostic targets', () => {
  test('a node-level error targets the node by id', () => {
    // Action with on-success but no on-error.
    const flow = FlowSchema.parse({
      id: 'f',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'action', id: 'a1', name: 'Send', kind: 'send-otp' },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'a1', trigger: { type: 'unconditional' } },
        { id: 'edge-2', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
      ],
    });
    expect(find(flow, 'validation-action-missing-error-edge')?.target).toEqual({
      kind: 'node',
      id: 'a1',
    });
  });

  test('an edge-level error targets the edge by id', () => {
    const flow = FlowSchema.parse({
      id: 'f',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        { type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' },
        { type: 'outcome', id: 'o2', name: 'B', kind: 'denied' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 'o1', trigger: { type: 'unconditional' } },
        { id: 'bad', source: 'o1', target: 'o2', trigger: { type: 'unconditional' } },
      ],
    });
    expect(find(flow, 'validation-outcome-has-outgoing-edge')?.target).toEqual({
      kind: 'edge',
      id: 'bad',
    });
  });

  test('a vocabulary warning targets the node by id', () => {
    const flow = FlowSchema.parse({
      id: 'f',
      name: 'X',
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'screen',
          id: 's1',
          name: 'Hello',
          kind: 'totally-custom-screen-kind',
        },
        { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
      ],
      edges: [
        { id: 'edge-1', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
        {
          id: 'edge-2',
          source: 's1',
          target: 'o1',
          trigger: { type: 'interaction', action: 'submit' },
        },
      ],
    });
    expect(find(flow, 'vocabulary-unknown-screen-kind')?.target).toEqual({
      kind: 'node',
      id: 's1',
    });
  });

  test('a flow-level error carries no target', () => {
    const flow = FlowSchema.parse({
      id: 'f',
      name: 'X',
      nodes: [{ type: 'outcome', id: 'o1', name: 'A', kind: 'authenticated' }],
      edges: [],
    });
    expect(find(flow, 'validation-entry-missing')?.target).toBeUndefined();
  });
});
