import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse, runScenario } from '@authprint/dsl';
import {
  derivePlayerSteps,
  divergedStepIndex,
  isSilentPlayerStep,
  lastScreenStepIndex,
} from './steps.ts';
import {
  timelineFillWidth,
  timelinePlayheadOffset,
  timelineStepIndexFromOffset,
  timelineStripWidth,
} from './timelineGeometry.ts';
import { advancePlayerPlayback, clampPlayerIndex } from './usePlayer.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function loadPasskeyEnrollment() {
  const text = readFileSync(
    `${here}/../../../../../../packages/dsl-spec/examples/passkey-enrollment.authprint`,
    'utf8',
  );
  const parsed = parse(text);
  if (!parsed.flow) throw new Error('passkey-enrollment failed to parse');
  return parsed.flow;
}

function loadLoginMfaFixture() {
  const parsed = parse(`id: login-mfa-fixture
name: Login MFA fixture
context:
  transaction.high_risk:
    type: boolean
nodes:
  - type: entry
    id: entry
  - type: screen
    id: s-password
    name: Sign in
    kind: password
    traits: [error-banner]
    fields: []
    fidelity: mockup
  - type: action
    id: a-auth
    name: POST /authenticate
    kind: validate-credentials
  - type: screen
    id: s-otp
    name: Enter code
    kind: mfa-challenge
    traits: [error-banner]
    fields: []
    fidelity: mockup
  - type: action
    id: a-verify
    name: POST /otp/verify
    kind: verify-otp
    errorMessage: Invalid code. Try again.
  - type: outcome
    id: o-ok
    name: Authenticated
    kind: authenticated
edges:
  - { id: e1, source: entry, target: s-password, trigger: { type: unconditional } }
  - { id: e2, source: s-password, target: a-auth, trigger: { type: interaction, action: submit } }
  - { id: e3, source: a-auth, target: s-password, trigger: { type: on-error } }
  - { id: e4, source: a-auth, target: s-otp, trigger: { type: on-success } }
  - { id: e5, source: s-otp, target: a-verify, trigger: { type: interaction, action: submit } }
  - { id: e6, source: a-verify, target: s-otp, trigger: { type: on-error } }
  - { id: e7, source: a-verify, target: o-ok, trigger: { type: on-success } }
scenarios:
  - id: sc-retry
    name: OTP retry
    initialContext: { transaction.high_risk: false }
    inputScript:
      - { type: screen, nodeId: s-password, action: submit }
      - { type: action, nodeId: a-auth, result: success }
      - { type: screen, nodeId: s-otp, action: submit }
      - { type: action, nodeId: a-verify, result: error }
      - { type: screen, nodeId: s-otp, action: submit }
      - { type: action, nodeId: a-verify, result: success }
    expectedOutcome: { outcomeId: o-ok }
`);
  if (!parsed.flow) throw new Error('login-mfa-fixture failed to parse');
  return parsed.flow;
}

describe('derivePlayerSteps — passkey-enrollment', () => {
  const flow = loadPasskeyEnrollment();

  for (const scenarioId of ['sc-returning-with-passkey', 'sc-new-user-enrolls-passkey']) {
    test(`${scenarioId}`, () => {
      const scenario = flow.scenarios.find((s) => s.id === scenarioId);
      expect(scenario).toBeDefined();
      if (!scenario) return;

      const run = runScenario(flow, scenario);
      expect(run.status).toBe('passed');

      const model = derivePlayerSteps(flow, run);
      expect(model.steps).toHaveLength(run.trace.length);
      expect(model.divergedIndex).toBeNull();
      expect(model.divergence).toBeNull();

      for (const [i, step] of model.steps.entries()) {
        const traceStep = run.trace[i];
        const snapshot = run.contextSnapshots[i];
        if (!traceStep || !snapshot) throw new Error('trace/snapshot length mismatch');
        expect(step.index).toBe(i);
        expect(step.nodeId).toBe(traceStep.nodeId);
        expect(step.context).toEqual(snapshot);
        expect(step.enteredViaError).toBe(false);
        expect(step.errorBannerCopy).toBeNull();
      }

      const decisionStep = model.steps.find((s) => s.nodeType === 'decision');
      expect(decisionStep?.decisionQuestion).toContain('?');
      expect(typeof decisionStep?.decisionBranch).toBe('boolean');

      const outcomeStep = model.steps.at(-1);
      expect(outcomeStep?.nodeType).toBe('outcome');
      expect(outcomeStep?.matchesExpectedOutcome).toBe(true);
      expect(outcomeStep?.exitTriggerLabel).toBeNull();
    });
  }

  test('screen step carries exit trigger label from the next edge', () => {
    const scenario = flow.scenarios.find((s) => s.id === 'sc-returning-with-passkey');
    expect(scenario).toBeDefined();
    if (!scenario) return;
    const run = runScenario(flow, scenario);
    const { steps } = derivePlayerSteps(flow, run);
    const identifier = steps.find((s) => s.nodeId === 's-identifier');
    expect(identifier?.exitTriggerLabel).toBe('submit');
  });
});

describe('derivePlayerSteps — error-banner copy', () => {
  test('surfaces banner copy when a screen is re-entered via on-error', () => {
    const flow = loadLoginMfaFixture();
    const scenario = flow.scenarios.find((s) => s.id === 'sc-retry');
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const run = runScenario(flow, scenario);
    expect(run.status).toBe('passed');

    const { steps } = derivePlayerSteps(flow, run);
    const secondOtpVisit = steps.filter((s) => s.nodeId === 's-otp').at(1);
    expect(secondOtpVisit?.enteredViaError).toBe(true);
    expect(secondOtpVisit?.errorBannerCopy).toBe('Invalid code. Try again.');
  });
});

describe('derivePlayerSteps — forced divergence', () => {
  test('surfaces diverged index and divergence data', () => {
    const flow = loadPasskeyEnrollment();
    const scenario = flow.scenarios.find((s) => s.id === 'sc-returning-with-passkey');
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const broken = {
      ...scenario,
      expectedOutcome: { outcomeId: 'o-authenticated-enrolled' },
    };
    const run = runScenario(flow, broken);
    expect(run.status).toBe('diverged');

    const model = derivePlayerSteps(flow, run);
    expect(model.divergence?.kind).toBe('unexpected-outcome');
    expect(model.divergedIndex).toBe(divergedStepIndex(run));
    expect(model.divergedIndex).toBe(run.trace.length - 1);
  });
});

describe('lastScreenStepIndex', () => {
  test('walks backward to the most recent screen before the active step', () => {
    const flow = loadLoginMfaFixture();
    const scenario = flow.scenarios.find((s) => s.id === 'sc-retry');
    expect(scenario).toBeDefined();
    if (!scenario) return;

    const run = runScenario(flow, scenario);
    const { steps } = derivePlayerSteps(flow, run);

    const verifyAction = steps.findIndex((s) => s.nodeId === 'a-verify');
    expect(verifyAction).toBeGreaterThan(0);
    const backdropIndex = lastScreenStepIndex(steps, verifyAction);
    expect(backdropIndex).toBe(verifyAction - 1);
    expect(steps[backdropIndex ?? -1]?.nodeType).toBe('screen');
  });

  test('returns null when no prior screen exists', () => {
    expect(lastScreenStepIndex([], 0)).toBeNull();
    expect(
      lastScreenStepIndex(
        [
          {
            index: 0,
            nodeId: 'e1',
            nodeType: 'entry',
            displayName: 'Start',
            exitTriggerLabel: null,
            decisionQuestion: null,
            decisionBranch: null,
            resolution: null,
            matchesExpectedOutcome: null,
            enteredViaError: false,
            errorBannerCopy: null,
            context: {},
          },
        ],
        1,
      ),
    ).toBeNull();
  });
});

describe('isSilentPlayerStep', () => {
  test('flags action, external, and decision only', () => {
    expect(isSilentPlayerStep('action')).toBe(true);
    expect(isSilentPlayerStep('external')).toBe(true);
    expect(isSilentPlayerStep('decision')).toBe(true);
    expect(isSilentPlayerStep('screen')).toBe(false);
    expect(isSilentPlayerStep('outcome')).toBe(false);
    expect(isSilentPlayerStep('entry')).toBe(false);
  });
});

describe('timelineGeometry', () => {
  test('playhead aligns to clip edges on first/last steps and centers otherwise', () => {
    expect(timelineStripWidth(3)).toBe(380);
    expect(timelinePlayheadOffset(0, 3)).toBe(6);
    expect(timelineFillWidth(0, 3)).toBe(0);
    expect(timelinePlayheadOffset(1, 3)).toBe(190);
    expect(timelinePlayheadOffset(2, 3)).toBe(374);
    expect(timelineFillWidth(2, 3)).toBe(374);
  });

  test('middle steps sit on clip centers for longer strips', () => {
    expect(timelinePlayheadOffset(1, 4)).toBe(190);
    expect(timelinePlayheadOffset(2, 4)).toBe(320);
    expect(timelinePlayheadOffset(3, 4)).toBe(504);
  });

  test('scrub position snaps to the nearest step index', () => {
    expect(timelineStepIndexFromOffset(6, 3)).toBe(0);
    expect(timelineStepIndexFromOffset(100, 3)).toBe(1);
    expect(timelineStepIndexFromOffset(300, 3)).toBe(2);
    expect(timelineStepIndexFromOffset(320, 4)).toBe(2);
  });
});

describe('usePlayer — playback helpers', () => {
  test('clampPlayerIndex bounds', () => {
    expect(clampPlayerIndex(-1, 5)).toBe(0);
    expect(clampPlayerIndex(99, 5)).toBe(4);
    expect(clampPlayerIndex(2, 0)).toBe(0);
  });

  test('advancePlayerPlayback steps forward', () => {
    expect(advancePlayerPlayback(0, 5, null)).toEqual({ index: 1, stop: false });
    expect(advancePlayerPlayback(3, 5, null)).toEqual({ index: 4, stop: true });
  });

  test('advancePlayerPlayback pauses at diverged index', () => {
    expect(advancePlayerPlayback(1, 6, 2)).toEqual({ index: 2, stop: true });
  });

  test('advancePlayerPlayback stops at last step', () => {
    expect(advancePlayerPlayback(4, 5, null)).toEqual({ index: 4, stop: true });
  });
});
