import { describe, expect, test } from 'bun:test';
import type { Flow } from '@authprint/dsl';
import { computeValidation, worstSeverity } from './useValidation.ts';

// entry → action(a1) → outcome; a1 is missing its on-error edge (a node error).
const broken: Flow = {
  id: 'f',
  name: 'X',
  theme: 'light',
  context: {},
  nodes: [
    { type: 'entry', id: 'e1' },
    { type: 'action', id: 'a1', name: 'Send', kind: 'send-otp' },
    { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
  ],
  edges: [
    { id: 'edge-1', source: 'e1', target: 'a1', trigger: { type: 'unconditional' } },
    { id: 'edge-2', source: 'a1', target: 'o1', trigger: { type: 'on-success' } },
  ],
  annotations: [],
  scenarios: [],
};

const fixed: Flow = {
  ...broken,
  edges: [
    ...broken.edges,
    { id: 'edge-3', source: 'a1', target: 'o1', trigger: { type: 'on-error' } },
  ],
};

describe('computeValidation', () => {
  test('a broken flow surfaces the node error under byNode', () => {
    const v = computeValidation(broken);
    expect(v.errorCount).toBeGreaterThan(0);
    expect(v.byNode.has('a1')).toBe(true);
    expect(v.byNode.get('a1')?.some((d) => d.code === 'validation-action-missing-error-edge')).toBe(
      true,
    );
  });

  test('fixing the flow clears the errors', () => {
    const v = computeValidation(fixed);
    expect(v.errorCount).toBe(0);
    expect(v.byNode.size).toBe(0);
    expect(v.byEdge.size).toBe(0);
  });

  test('worstSeverity: error beats warning; empty → null', () => {
    expect(worstSeverity(computeValidation(broken).byNode.get('a1'))).toBe('error');
    expect(worstSeverity([])).toBeNull();
    expect(worstSeverity(undefined)).toBeNull();
  });
});
