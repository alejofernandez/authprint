import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { type Flow, FlowSchema, parse, type Scenario } from '@authprint/dsl';
import {
  appendResolutionStep,
  appendScreenStep,
  applyBranchFix,
  deleteFromStep,
  deriveRecording,
  reconcileDraft,
  setInitialContextValue,
  setStepPatch,
} from './recorder.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

function loadPasskeyEnrollment(): Flow {
  const text = readFileSync(
    `${here}/../../../../../../packages/dsl-spec/examples/passkey-enrollment.authprint`,
    'utf8',
  );
  const parsed = parse(text);
  if (!parsed.flow) throw new Error('passkey-enrollment failed to parse');
  return parsed.flow;
}

function emptyDraft(overrides?: Partial<Scenario>): Scenario {
  return {
    id: 'sc-draft',
    name: 'Draft',
    initialContext: { 'user.exists': false, 'user.has_passkey': false },
    inputScript: [],
    ...overrides,
  };
}

describe('deriveRecording', () => {
  const flow = loadPasskeyEnrollment();

  test('record-from-empty head starts at identifier screen', () => {
    const draft = emptyDraft();
    const recording = deriveRecording(flow, draft);
    expect(recording.head).toEqual({ nodeId: 's-identifier', nodeType: 'screen' });
    expect(recording.pendingDecision).toBeNull();
    expect(recording.note).toBeNull();
    expect(recording.steps[0]?.nodeType).toBe('entry');
    expect(recording.steps.at(-1)?.nodeId).toBe('s-identifier');
  });
});

describe('recording through passkey-enrollment', () => {
  const flow = loadPasskeyEnrollment();

  test('full new-user walk records to enrolled outcome', () => {
    let draft = emptyDraft();
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    expect(deriveRecording(flow, draft).head.nodeId).toBe('d-user-exists');

    draft = appendResolutionStep(flow, draft, 'a-send-otp', 'success');
    expect(deriveRecording(flow, draft).head.nodeId).toBe('s-otp');

    draft = appendScreenStep(flow, draft, 's-otp', 'submit');
    expect(deriveRecording(flow, draft).pendingDecision?.nodeId).toBe('d-has-passkey');

    draft = appendScreenStep(flow, draft, 's-passkey-enroll', 'submit');
    expect(deriveRecording(flow, draft).head.nodeType).toBe('outcome');
    expect(draft.expectedOutcome?.outcomeId).toBe('o-authenticated-enrolled');
  });

  test('decision initial-context fix flips the user-exists branch', () => {
    let draft = emptyDraft({ initialContext: { 'user.exists': false, 'user.has_passkey': true } });
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    expect(deriveRecording(flow, draft).pendingDecision?.nodeId).toBe('d-user-exists');

    const fix = deriveRecording(flow, draft).pendingDecision?.fixes.find(
      (f) => f.kind === 'initial-context',
    );
    expect(fix?.kind).toBe('initial-context');
    if (fix?.kind !== 'initial-context') throw new Error('expected fix');
    expect(fix.value).toBe(true);

    draft = applyBranchFix(flow, draft, fix);
    draft = appendScreenStep(flow, draft, 's-passkey', 'submit');
    expect(deriveRecording(flow, draft).head.nodeId).toBe('o-authenticated-passkey');
  });

  test('decision step-patch fix flips the has-passkey branch', () => {
    let draft = emptyDraft();
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    draft = appendResolutionStep(flow, draft, 'a-send-otp', 'success');
    draft = appendScreenStep(flow, draft, 's-otp', 'submit');

    const patchFix = deriveRecording(flow, draft).pendingDecision?.fixes.find(
      (f) => f.kind === 'step-patch',
    );
    expect(patchFix?.kind).toBe('step-patch');
    if (patchFix?.kind !== 'step-patch') throw new Error('expected step-patch fix');

    draft = applyBranchFix(flow, draft, patchFix);
    expect(deriveRecording(flow, draft).head.nodeId).toBe('o-authenticated-otp');
    expect(draft.expectedOutcome?.outcomeId).toBe('o-authenticated-otp');
  });
});

describe('tail-drop', () => {
  const flow = loadPasskeyEnrollment();

  test('changed action truncates the tail', () => {
    let draft = emptyDraft();
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    draft = appendResolutionStep(flow, draft, 'a-send-otp', 'success');
    draft = appendScreenStep(flow, draft, 's-otp', 'submit');

    const first = draft.inputScript[0];
    if (!first) throw new Error('expected first step');
    const broken = {
      ...draft,
      inputScript: [
        first,
        { type: 'action' as const, nodeId: 's-otp', result: 'success' as const },
      ],
    };
    const { draft: reconciled, note } = reconcileDraft(flow, broken);
    expect(note).toBe('script tail dropped after edit');
    expect(reconciled.inputScript).toHaveLength(1);
  });

  test('changed initial value truncates when trace diverges', () => {
    let draft = emptyDraft();
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    draft = appendResolutionStep(flow, draft, 'a-send-otp', 'success');

    const updated = setInitialContextValue(flow, draft, 'user.exists', true);
    expect(updated.inputScript.length).toBeLessThan(draft.inputScript.length);
  });

  test('deleteFromStep drops tail from index', () => {
    let draft = emptyDraft();
    draft = appendScreenStep(flow, draft, 's-identifier', 'submit');
    draft = appendResolutionStep(flow, draft, 'a-send-otp', 'success');
    expect(deleteFromStep(flow, draft, 1).inputScript).toHaveLength(1);
  });
});

describe('loops and patches', () => {
  test('loop append is legal and surfaces step-limit as a note', () => {
    const parsed = parse(`id: loop-fixture
name: Loop fixture
context:
  code.valid:
    type: boolean
nodes:
  - { type: entry, id: e1 }
  - type: screen
    id: s-otp
    name: OTP
    kind: mfa-challenge
    traits: []
    fields: []
    fidelity: lo-fi
  - type: decision
    id: d-valid
    kind: code-valid
    predicate: { slot: code.valid, op: equals, value: true }
  - { type: outcome, id: o1, name: OK, kind: authenticated }
edges:
  - { id: e1, source: e1, target: s-otp, trigger: { type: unconditional } }
  - { id: e2, source: s-otp, target: d-valid, trigger: { type: interaction, action: submit } }
  - { id: e3, source: d-valid, target: o1, trigger: { type: branch, value: true } }
  - { id: e4, source: d-valid, target: s-otp, trigger: { type: branch, value: false } }
scenarios: []`);
    if (!parsed.flow) throw new Error('parse failed');
    const flow = parsed.flow;

    let draft: Scenario = {
      id: 'sc-loop',
      name: 'Loop',
      initialContext: { 'code.valid': false },
      inputScript: [],
    };

    for (let i = 0; i < 25; i++) {
      draft = appendScreenStep(flow, draft, 's-otp', 'submit');
    }

    const recording = deriveRecording(flow, draft);
    expect(recording.note).toBe('step-limit-exceeded');
    expect(draft.inputScript.filter((s) => s.nodeId === 's-otp').length).toBe(25);
  });

  test('set: patch on loop step flips branch', () => {
    const parsed = parse(`id: loop-fixture
name: Loop fixture
context:
  code.valid:
    type: boolean
nodes:
  - { type: entry, id: e1 }
  - type: screen
    id: s-otp
    name: OTP
    kind: mfa-challenge
    traits: []
    fields: []
    fidelity: lo-fi
  - type: decision
    id: d-valid
    kind: code-valid
    predicate: { slot: code.valid, op: equals, value: true }
  - { type: outcome, id: o1, name: OK, kind: authenticated }
edges:
  - { id: e1, source: e1, target: s-otp, trigger: { type: unconditional } }
  - { id: e2, source: s-otp, target: d-valid, trigger: { type: interaction, action: submit } }
  - { id: e3, source: d-valid, target: o1, trigger: { type: branch, value: true } }
  - { id: e4, source: d-valid, target: s-otp, trigger: { type: branch, value: false } }
scenarios: []`);
    if (!parsed.flow) throw new Error('parse failed');
    const flow = parsed.flow;

    let draft: Scenario = {
      id: 'sc-retry',
      name: 'Retry',
      initialContext: { 'code.valid': false },
      inputScript: [],
    };
    draft = appendScreenStep(flow, draft, 's-otp', 'submit');
    draft = appendScreenStep(flow, draft, 's-otp', 'submit');
    draft = setStepPatch(flow, draft, 1, 'code.valid', true);
    expect(deriveRecording(flow, draft).head.nodeId).toBe('o1');
    expect(draft.expectedOutcome?.outcomeId).toBe('o1');
  });
});

describe('predicate semantics parity with the interpreter', () => {
  function gateFlow(predicate: Record<string, unknown>, slotType: string): Flow {
    return FlowSchema.parse({
      id: 'f-gate',
      name: 'Gate',
      context: { [predicate.slot as string]: { type: slotType } },
      nodes: [
        { type: 'entry', id: 'e' },
        { type: 'screen', id: 's-start', name: 'Start', kind: 'identifier-collect' },
        { type: 'decision', id: 'd-gate', kind: 'risk', predicate },
        { type: 'screen', id: 's-high', name: 'High', kind: 'mfa-challenge' },
        { type: 'screen', id: 's-low', name: 'Low', kind: 'confirmation' },
      ],
      edges: [
        { id: 'edge-entry', source: 'e', target: 's-start', trigger: { type: 'unconditional' } },
        {
          id: 'edge-continue',
          source: 's-start',
          target: 'd-gate',
          trigger: { type: 'interaction', action: 'continue' },
        },
        {
          id: 'edge-true',
          source: 'd-gate',
          target: 's-high',
          trigger: { type: 'branch', value: true },
        },
        {
          id: 'edge-false',
          source: 'd-gate',
          target: 's-low',
          trigger: { type: 'branch', value: false },
        },
      ],
    });
  }

  function draftAtGate(initialContext: Record<string, unknown>): Scenario {
    return {
      id: 'sc-gate',
      name: 'Gate draft',
      initialContext,
      inputScript: [{ type: 'screen', nodeId: 's-start', action: 'continue' }],
    };
  }

  test('numeric decision head reports the branch context dictates', () => {
    const flow = gateFlow({ slot: 'risk.score', op: 'greater-than', value: 50 }, 'number');
    const { head, pendingDecision } = deriveRecording(flow, draftAtGate({ 'risk.score': 80 }));
    expect(head.nodeId).toBe('d-gate');
    expect(pendingDecision?.takenBranch).toBe(true);
    expect(pendingDecision?.takenDestinationId).toBe('s-high');
    expect(pendingDecision?.fixes).toEqual([
      { kind: 'needs-value', slot: 'risk.score', op: 'greater-than' },
    ]);
  });

  test('string equals back-solve degrades to needs-value, never a null write', () => {
    const flow = gateFlow({ slot: 'user.type', op: 'equals', value: 'admin' }, 'string');
    const { pendingDecision } = deriveRecording(flow, draftAtGate({ 'user.type': 'admin' }));
    expect(pendingDecision?.takenBranch).toBe(true);
    expect(pendingDecision?.fixes).toEqual([
      { kind: 'needs-value', slot: 'user.type', op: 'equals' },
    ]);
  });
});
