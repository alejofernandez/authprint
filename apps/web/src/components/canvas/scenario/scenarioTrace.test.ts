import { describe, expect, test } from 'bun:test';
import type { ScenarioRun } from '@authprint/dsl';
import { buildTraceAttachment } from './scenarioTrace.ts';

const baseRun: ScenarioRun = {
  scenarioId: 's1',
  trace: [
    { nodeId: 'entry', viaEdgeId: null },
    { nodeId: 'screen-a', viaEdgeId: 'e1' },
    { nodeId: 'outcome', viaEdgeId: 'e2' },
  ],
  reachedOutcomeId: 'outcome',
  status: 'passed',
  divergence: null,
};

describe('buildTraceAttachment', () => {
  test('step 0 highlights entry as active', () => {
    const trace = buildTraceAttachment(baseRun, 0);
    expect(trace.byNode.get('entry')).toBe('active');
    expect(trace.byNode.get('screen-a')).toBeUndefined();
    expect(trace.byEdge.size).toBe(0);
  });

  test('middle step greys visited nodes and highlights incoming edge', () => {
    const trace = buildTraceAttachment(baseRun, 1);
    expect(trace.byNode.get('entry')).toBe('visited');
    expect(trace.byNode.get('screen-a')).toBe('active');
    expect(trace.byEdge.get('e1')).toBe('active');
  });

  test('diverged run at end marks deviation node red', () => {
    const diverged: ScenarioRun = {
      ...baseRun,
      status: 'diverged',
      reachedOutcomeId: null,
      divergence: { kind: 'script-mismatch', nodeId: 'screen-a', detail: 'wrong action' },
    };
    const trace = buildTraceAttachment(diverged, diverged.trace.length - 1);
    expect(trace.byNode.get('screen-a')).toBe('diverged');
    expect(trace.tooltips.get('screen-a')).toContain('Script mismatch');
  });
});
