import { describe, expect, test } from 'bun:test';
import { FlowSchema } from '@authprint/dsl';
import {
  findSwappableSiblingEdge,
  isEditableEdgeTrigger,
  usedScreenInteractionActions,
} from './edgeTriggerUtils.ts';

describe('isEditableEdgeTrigger', () => {
  test('allows branch, interaction, and action result triggers', () => {
    expect(isEditableEdgeTrigger({ type: 'branch', value: true })).toBe(true);
    expect(isEditableEdgeTrigger({ type: 'interaction', action: 'submit' })).toBe(true);
    expect(isEditableEdgeTrigger({ type: 'on-success' })).toBe(true);
    expect(isEditableEdgeTrigger({ type: 'on-error' })).toBe(true);
  });

  test('rejects unconditional and external-only triggers', () => {
    expect(isEditableEdgeTrigger({ type: 'unconditional' })).toBe(false);
    expect(isEditableEdgeTrigger({ type: 'on-denied' })).toBe(false);
  });
});

describe('findSwappableSiblingEdge', () => {
  const flow = FlowSchema.parse({
    id: 'f1',
    name: 'X',
    context: { u: { type: 'boolean' } },
    nodes: [
      { type: 'entry', id: 'e1' },
      {
        type: 'decision',
        id: 'd1',
        kind: 'user-exists',
        predicate: { slot: 'u', op: 'equals', value: true },
      },
      { type: 'action', id: 'a1', name: 'Send', kind: 'send-email' },
      { type: 'outcome', id: 'o1', name: 'Yes', kind: 'authenticated' },
      { type: 'outcome', id: 'o2', name: 'No', kind: 'denied' },
      { type: 'outcome', id: 'o3', name: 'Ok', kind: 'authenticated' },
      { type: 'outcome', id: 'o4', name: 'Err', kind: 'error' },
    ],
    edges: [
      { id: 'edge-1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
      { id: 'edge-2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      { id: 'edge-3', source: 'd1', target: 'o2', trigger: { type: 'branch', value: false } },
      { id: 'edge-4', source: 'a1', target: 'o3', trigger: { type: 'on-success' } },
      { id: 'edge-5', source: 'a1', target: 'o4', trigger: { type: 'on-error' } },
    ],
  });

  test('finds opposite decision branch', () => {
    const edge = flow.edges.find((e) => e.id === 'edge-2');
    if (!edge) throw new Error('edge-2 missing');
    const sibling = findSwappableSiblingEdge(flow, edge);
    expect(sibling?.id).toBe('edge-3');
  });

  test('finds action success/error sibling', () => {
    const edge = flow.edges.find((e) => e.id === 'edge-4');
    if (!edge) throw new Error('edge-4 missing');
    const sibling = findSwappableSiblingEdge(flow, edge);
    expect(sibling?.id).toBe('edge-5');
  });
});

describe('usedScreenInteractionActions', () => {
  test('collects other interaction actions from the same screen', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
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
          source: 's1',
          target: 's2',
          trigger: { type: 'interaction', action: 'back' },
        },
      ],
    });
    const edge = flow.edges.find((e) => e.id === 'edge-2');
    if (!edge) throw new Error('edge-2 missing');
    expect([...usedScreenInteractionActions(flow, edge)]).toEqual(['back']);
  });
});
