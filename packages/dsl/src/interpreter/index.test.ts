import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from '../parser/index.ts';
import type { Flow } from '../schema/flow.ts';
import { FlowSchema } from '../schema/flow.ts';
import type { Scenario } from '../schema/scenario.ts';
import { type Divergence, runScenario } from './index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function loadDemoFlowZero(): Flow {
  const text = readFileSync(`${here}/../../../dsl-spec/examples/demo-flow-zero.authprint`, 'utf8');
  const parsed = parse(text);
  expect(parsed.flow).not.toBeNull();
  if (!parsed.flow) throw new Error('demo-flow-zero failed to parse');
  return parsed.flow;
}

/** Minimal happy-path flow: entry → screen → outcome */
function minimalScreenFlow(overrides?: { edges?: Flow['edges']; scenario?: Partial<Scenario> }): {
  flow: Flow;
  scenario: Scenario;
} {
  const flow = FlowSchema.parse({
    id: 'f-min',
    name: 'Minimal',
    nodes: [
      { type: 'entry', id: 'e1' },
      { type: 'screen', id: 's1', name: 'S', kind: 'identifier-collect' },
      { type: 'outcome', id: 'o1', name: 'Done', kind: 'authenticated' },
    ],
    edges: overrides?.edges ?? [
      { id: 'e-entry', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
      {
        id: 'e-submit',
        source: 's1',
        target: 'o1',
        trigger: { type: 'interaction', action: 'submit' },
      },
    ],
  });
  const scenario: Scenario = {
    id: 'sc1',
    name: 'Happy',
    initialContext: {},
    inputScript: [{ type: 'screen', nodeId: 's1', action: 'submit' }],
    ...overrides?.scenario,
  };
  return { flow, scenario };
}

describe('runScenario — demo-flow-zero', () => {
  const flow = loadDemoFlowZero();
  const scenarioIds = [
    'sc-returning-passkey-autofill',
    'sc-returning-passkey-explicit',
    'sc-returning-google',
    'sc-returning-otp',
    'sc-new-user-google-enrolls-passkey',
    'sc-new-user-otp-skips-passkey',
    'sc-otp-retry-then-success',
  ];

  for (const id of scenarioIds) {
    test(`${id} → passed`, () => {
      const scenario = flow.scenarios.find((s) => s.id === id);
      expect(scenario).toBeDefined();
      if (!scenario) return;
      const run = runScenario(flow, scenario);
      expect(run.status).toBe('passed');
      expect(run.divergence).toBeNull();
      if (scenario.expectedOutcome?.outcomeId) {
        expect(run.reachedOutcomeId).toBe(scenario.expectedOutcome.outcomeId);
      }
    });
  }
});

describe('runScenario — divergence kinds', () => {
  test('no-matching-edge', () => {
    const { flow, scenario } = minimalScreenFlow({
      edges: [
        { id: 'e-entry', source: 'e1', target: 's1', trigger: { type: 'unconditional' } },
        // screen has no outgoing edges
      ],
    });
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('no-matching-edge');
  });

  test('script-mismatch', () => {
    const { flow } = minimalScreenFlow();
    const scenario: Scenario = {
      id: 'sc-bad',
      name: 'Bad script',
      initialContext: {},
      inputScript: [{ type: 'screen', nodeId: 'wrong-id', action: 'submit' }],
    };
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('script-mismatch');
  });

  test('script-exhausted', () => {
    const { flow, scenario } = minimalScreenFlow({
      scenario: { inputScript: [] },
    });
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('script-exhausted');
    if (run.divergence?.kind === 'script-exhausted') {
      expect(run.divergence.nodeId).toBe('s1');
    }
  });

  test('unknown-slot', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { 'user.exists': { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'user-exists',
          predicate: { slot: 'user.exists', op: 'equals', value: true },
        },
        { type: 'outcome', id: 'o1', name: 'Y', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'e2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      ],
    });
    const scenario: Scenario = {
      id: 'sc1',
      name: 'No context',
      initialContext: {},
      inputScript: [],
    };
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence).toEqual({
      kind: 'unknown-slot',
      nodeId: 'd1',
      slot: 'user.exists',
    } satisfies Divergence);
  });

  test('predicate-type-error', () => {
    const flow = FlowSchema.parse({
      id: 'f1',
      name: 'X',
      context: { score: { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'risk',
          predicate: { slot: 'score', op: 'greater-than', value: 5 },
        },
        { type: 'outcome', id: 'o1', name: 'Y', kind: 'authenticated' },
      ],
      edges: [
        { id: 'e1', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'e2', source: 'd1', target: 'o1', trigger: { type: 'branch', value: true } },
      ],
    });
    const scenario: Scenario = {
      id: 'sc1',
      name: 'Bool not number',
      initialContext: { score: true },
      inputScript: [],
    };
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('predicate-type-error');
  });

  test('unexpected-outcome', () => {
    const { flow, scenario } = minimalScreenFlow({
      scenario: {
        expectedOutcome: { outcomeId: 'o-wrong' },
      },
    });
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence).toEqual({
      kind: 'unexpected-outcome',
      nodeId: 'o1',
      expected: 'o-wrong',
      actual: 'o1',
    } satisfies Divergence);
  });

  test('sequence-mismatch', () => {
    const { flow, scenario } = minimalScreenFlow({
      scenario: {
        expectedOutcome: { sequence: ['e1', 's1', 'o-wrong'] },
      },
    });
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('sequence-mismatch');
    if (run.divergence?.kind === 'sequence-mismatch') {
      expect(run.divergence.atIndex).toBe(2);
      expect(run.divergence.expected).toBe('o-wrong');
      expect(run.divergence.actual).toBe('o1');
    }
  });

  test('step-limit-exceeded', () => {
    const flow = FlowSchema.parse({
      id: 'f-loop',
      name: 'Loop',
      context: { flag: { type: 'boolean' } },
      nodes: [
        { type: 'entry', id: 'e1' },
        {
          type: 'decision',
          id: 'd1',
          kind: 'always-true',
          predicate: { slot: 'flag', op: 'equals', value: true },
        },
        {
          type: 'decision',
          id: 'd2',
          kind: 'always-true',
          predicate: { slot: 'flag', op: 'equals', value: true },
        },
      ],
      edges: [
        { id: 'e-entry', source: 'e1', target: 'd1', trigger: { type: 'unconditional' } },
        { id: 'e-d1-true', source: 'd1', target: 'd2', trigger: { type: 'branch', value: true } },
        { id: 'e-d2-true', source: 'd2', target: 'd1', trigger: { type: 'branch', value: true } },
      ],
    });
    const scenario: Scenario = {
      id: 'sc-loop',
      name: 'Infinite loop',
      initialContext: { flag: true },
      inputScript: [],
    };
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('diverged');
    expect(run.divergence?.kind).toBe('step-limit-exceeded');
  });
});

describe('runScenario — minimal happy path', () => {
  test('entry → screen → outcome', () => {
    const { flow, scenario } = minimalScreenFlow();
    const run = runScenario(flow, scenario);
    expect(run.status).toBe('passed');
    expect(run.trace.map((t) => t.nodeId)).toEqual(['e1', 's1', 'o1']);
    expect(run.trace[0]?.viaEdgeId).toBeNull();
    expect(run.trace[1]?.viaEdgeId).toBe('e-entry');
    expect(run.trace[2]?.viaEdgeId).toBe('e-submit');
  });
});
