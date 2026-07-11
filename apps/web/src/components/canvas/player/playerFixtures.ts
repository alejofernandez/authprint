import type {
  ActionNode,
  DecisionNode,
  EntryNode,
  ExternalNode,
  OutcomeNode,
  ScreenNode,
} from '@authprint/dsl';
import type { PlayerStep } from './steps.ts';

const baseContext = { 'user.exists': false, 'user.has_passkey': false };

function step(
  partial: Omit<PlayerStep, 'context' | 'enteredViaError' | 'errorBannerCopy' | 'exitActionId'> & {
    context?: Record<string, unknown>;
    enteredViaError?: boolean;
    errorBannerCopy?: string | null;
    exitActionId?: string | null;
  },
): PlayerStep {
  return {
    context: baseContext,
    enteredViaError: false,
    errorBannerCopy: null,
    exitActionId: null,
    ...partial,
  };
}

export const fixtureEntry: EntryNode = { type: 'entry', id: 'e1' };

export const fixtureScreenLoFi: ScreenNode = {
  type: 'screen',
  id: 's-lofi',
  name: 'Sign in',
  kind: 'password',
  traits: [],
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'password', type: 'password', required: true },
  ],
  fidelity: 'lo-fi',
};

export const fixtureScreenWireframe: ScreenNode = {
  ...fixtureScreenLoFi,
  id: 's-wire',
  fidelity: 'wireframe',
};

export const fixtureScreenMockup: ScreenNode = {
  ...fixtureScreenLoFi,
  id: 's-mock',
  fidelity: 'mockup',
};

export const fixtureScreenMockupWithErrorBanner: ScreenNode = {
  ...fixtureScreenMockup,
  id: 's-mock-error',
  traits: ['error-banner'],
};

export const fixtureScreenMfa: ScreenNode = {
  type: 'screen',
  id: 's-otp',
  name: 'Enter code',
  kind: 'mfa-challenge',
  traits: [],
  fields: [{ name: 'code', type: 'otp', required: true }],
  fidelity: 'mockup',
};

export const fixtureScreenPasskeyEnroll: ScreenNode = {
  type: 'screen',
  id: 's-enroll',
  name: 'Set up a passkey',
  kind: 'passkey-enroll',
  traits: ['passkey-promotion'],
  fields: [{ name: 'passkey', type: 'passkey', required: true }],
  fidelity: 'mockup',
};

export const fixtureActionVerify: ActionNode = {
  type: 'action',
  id: 'a-verify',
  name: 'POST /otp/verify',
  kind: 'verify-otp',
};

export const fixtureDecision: DecisionNode = {
  type: 'decision',
  id: 'd1',
  name: 'Account exists?',
  kind: 'user-exists',
  predicate: { slot: 'user.exists', op: 'equals', value: true },
};

export const fixtureAction: ActionNode = {
  type: 'action',
  id: 'a1',
  name: 'Send sign-in code',
  kind: 'send-otp',
};

export const fixtureExternal: ExternalNode = {
  type: 'external',
  id: 'x1',
  name: 'Continue with Google',
  kind: 'google',
};

export const fixtureOutcomeSuccess: OutcomeNode = {
  type: 'outcome',
  id: 'o1',
  name: 'Authenticated',
  kind: 'authenticated',
};

export const fixtureOutcomeError: OutcomeNode = {
  type: 'outcome',
  id: 'o2',
  name: 'User left',
  kind: 'abandoned',
};

export const stepEntry = step({
  index: 0,
  nodeId: 'e1',
  nodeType: 'entry',
  displayName: 'Start',
  exitTriggerLabel: null,
  decisionQuestion: null,
  decisionBranch: null,
  resolution: null,
  matchesExpectedOutcome: null,
});

export const stepScreenMockup = step({
  index: 1,
  nodeId: 's-mock',
  nodeType: 'screen',
  displayName: 'Sign in',
  exitTriggerLabel: 'submit',
  exitActionId: 'submit',
  decisionQuestion: null,
  decisionBranch: null,
  resolution: null,
  matchesExpectedOutcome: null,
});

export const stepScreenMockupError = step({
  ...stepScreenMockup,
  nodeId: 's-mock-error',
  enteredViaError: true,
  errorBannerCopy: 'Invalid code. Try again.',
});

export const stepDecision = step({
  index: 2,
  nodeId: 'd1',
  nodeType: 'decision',
  displayName: 'Account exists?',
  exitTriggerLabel: 'no',
  decisionQuestion: 'user.exists equals true?',
  decisionBranch: false,
  resolution: null,
  matchesExpectedOutcome: null,
});

export const stepAction = step({
  index: 3,
  nodeId: 'a1',
  nodeType: 'action',
  displayName: 'Send sign-in code',
  exitTriggerLabel: 'success',
  decisionQuestion: null,
  decisionBranch: null,
  resolution: 'success',
  matchesExpectedOutcome: null,
});

export const stepScreenMfa = step({
  index: 2,
  nodeId: 's-otp',
  nodeType: 'screen',
  displayName: 'Enter code',
  exitTriggerLabel: 'submit',
  exitActionId: 'submit',
  decisionQuestion: null,
  decisionBranch: null,
  resolution: null,
  matchesExpectedOutcome: null,
});

export const stepScreenPasskeySkip = step({
  index: 5,
  nodeId: 's-enroll',
  nodeType: 'screen',
  displayName: 'Set up a passkey',
  exitTriggerLabel: 'skip',
  exitActionId: 'skip',
  decisionQuestion: null,
  decisionBranch: null,
  resolution: null,
  matchesExpectedOutcome: null,
});

export const stepActionVerify = step({
  index: 3,
  nodeId: 'a-verify',
  nodeType: 'action',
  displayName: 'POST /otp/verify',
  exitTriggerLabel: 'success',
  decisionQuestion: null,
  decisionBranch: null,
  resolution: 'success',
  matchesExpectedOutcome: null,
});

export const stepOutcomeSuccess = step({
  index: 4,
  nodeId: 'o1',
  nodeType: 'outcome',
  displayName: 'Authenticated',
  exitTriggerLabel: null,
  decisionQuestion: null,
  decisionBranch: null,
  resolution: null,
  matchesExpectedOutcome: true,
});

export const stepOutcomeError = step({
  ...stepOutcomeSuccess,
  index: 5,
  nodeId: 'o2',
  displayName: 'User left',
  matchesExpectedOutcome: false,
});

export function buildLongStripSteps(count = 15): PlayerStep[] {
  const names = [
    'Enter your email',
    'Account exists?',
    'Send sign-in code',
    'Enter the code',
    'Passkey available?',
    'Set up a passkey',
    'Authenticated',
  ];
  const types: PlayerStep['nodeType'][] = [
    'entry',
    'screen',
    'decision',
    'action',
    'screen',
    'decision',
    'screen',
    'outcome',
  ];
  return Array.from({ length: count }, (_, index) =>
    step({
      index,
      nodeId: `n-${index}`,
      nodeType: types[index % types.length] ?? 'screen',
      displayName: names[index % names.length] ?? `Step ${index + 1}`,
      exitTriggerLabel: index === count - 1 ? null : 'submit',
      exitActionId: index === count - 1 ? null : 'submit',
      decisionQuestion:
        types[index % types.length] === 'decision' ? 'user.exists equals true?' : null,
      decisionBranch: types[index % types.length] === 'decision' ? false : null,
      resolution: types[index % types.length] === 'action' ? 'success' : null,
      matchesExpectedOutcome: types[index % types.length] === 'outcome' ? true : null,
    }),
  );
}
