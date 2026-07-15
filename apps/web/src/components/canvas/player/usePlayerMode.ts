// US-110 / US-120 — player-mode session + Edit⇄Play shell + headless playback.

import type { Flow, Scenario, ScenarioRun } from '@authprint/dsl';
import { runScenario } from '@authprint/dsl';
import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  appendResolutionStep,
  appendScreenStep,
  applyBranchFix,
  type BranchFix,
  clearExpectedOutcome,
  clearStepPatch,
  deleteFromStep,
  deriveRecording,
  editStepChoice,
  type RecordingModel,
  reconcileDraft,
  setExpectedOutcome,
  setStepPatch,
} from './recorder.ts';
import { createBlankScenario, duplicateScenarioName, uniqueScenarioId } from './scenarioNames.ts';
import { derivePlayerSteps } from './steps.ts';
import { usePlayer } from './usePlayer.ts';

export type PlayerShellMode = 'empty' | 'edit' | 'play';

export type PlayerSession = {
  run: ScenarioRun;
  name: string;
  flow: Flow;
  initialContext: Record<string, unknown>;
};

export type PlayerModePersist = {
  persistScenario: (scenario: Scenario) => void;
  removeScenario: (id: string) => void;
};

export type PlayerModeValue = {
  /** Null when the player overlay is closed. */
  shellMode: PlayerShellMode | null;
  /** Play-mode run session (also set briefly when switching edit→play). */
  session: PlayerSession | null;
  /** Live edit draft (shellMode === 'edit'); null otherwise. */
  draft: Scenario | null;
  /** Flow accompanying the open player (empty / edit / play). */
  flow: Flow | null;
  recording: RecordingModel | null;
  steps: ReturnType<typeof derivePlayerSteps>['steps'];
  divergedIndex: number | null;
  divergence: ReturnType<typeof derivePlayerSteps>['divergence'];
  recordingNote: string | null;
  /** Open empty-state card (zero scenarios). */
  enterEmpty: (flow: Flow) => void;
  /** Open Play mode for a scenario. */
  enterPlay: (scenario: Scenario, flow: Flow) => void;
  /** Open Edit mode; reconciles the draft on entry. */
  enterEdit: (scenario: Scenario, flow: Flow) => void;
  /** Create a fresh scenario, persist, enter Edit. */
  startRecording: (flow: Flow, defaultName: string) => void;
  setShellMode: (mode: 'edit' | 'play') => void;
  exit: () => void;
  renameDraft: (name: string) => void;
  duplicateActive: (
    copySuffixName?: (name: string, existing: readonly Scenario[]) => string,
  ) => void;
  deleteActive: () => void;
  /** Stage / filmstrip gestures — each persists one undoable putScenario. */
  recordAction: (actionId: string) => void;
  recordResult: (result: string) => void;
  continueDecision: () => void;
  applyFix: (fix: BranchFix, value?: unknown) => void;
  toggleExpectedOutcome: (checked: boolean) => void;
  editStepAction: (scriptStepIndex: number, action: string) => void;
  editStepResult: (
    scriptStepIndex: number,
    result: 'success' | 'error' | 'denied' | 'cancelled',
  ) => void;
  editStepPatch: (scriptStepIndex: number, slot: string, value: unknown | null) => void;
  deleteFrom: (scriptStepIndex: number) => void;
  doneRecording: () => void;
  /** Legacy play entry (US-110 call sites). */
  enter: (
    run: ScenarioRun,
    name: string,
    flow: Flow,
    initialContext: Record<string, unknown>,
  ) => void;
} & ReturnType<typeof usePlayer>;

export function usePlayerMode(persist?: PlayerModePersist): PlayerModeValue {
  const [shellMode, setShellModeState] = useState<PlayerShellMode | null>(null);
  const [session, setSession] = useState<PlayerSession | null>(null);
  const [draft, setDraft] = useState<Scenario | null>(null);
  const [flow, setFlow] = useState<Flow | null>(null);
  const [confirmedDecisionIds, setConfirmedDecisionIds] = useState<ReadonlySet<string>>(
    () => new Set(),
  );
  const [recordingNote, setRecordingNote] = useState<string | null>(null);

  const recording = useMemo(() => {
    if (shellMode !== 'edit' || !draft || !flow) return null;
    return deriveRecording(flow, draft, { confirmedDecisionIds });
  }, [shellMode, draft, flow, confirmedDecisionIds]);

  const playModel = useMemo(() => {
    if (shellMode !== 'play' || !session) {
      return { steps: [], divergedIndex: null as number | null, divergence: null };
    }
    return derivePlayerSteps(session.flow, session.run);
  }, [shellMode, session]);

  const steps = shellMode === 'edit' ? (recording?.steps ?? []) : playModel.steps;
  const divergedIndex = shellMode === 'edit' ? null : playModel.divergedIndex;
  const divergence = shellMode === 'edit' ? null : playModel.divergence;

  const sessionKey =
    shellMode === 'play'
      ? (session?.run.scenarioId ?? null)
      : shellMode === 'edit'
        ? (draft?.id ?? null)
        : null;

  const player = usePlayer({
    steps,
    divergedIndex,
  });

  const { seek, pause } = player;

  useEffect(() => {
    if (!sessionKey) return;
    seek(0);
    pause();
  }, [sessionKey, seek, pause]);

  const writeDraft = useCallback(
    (
      next: Scenario,
      baseFlow: Flow,
      options?: { resetConfirmed?: boolean; note?: string | null },
    ) => {
      persist?.persistScenario(next);
      setDraft(next);
      setFlow(flowWithScenario(baseFlow, next));
      if (options?.resetConfirmed !== false) {
        setConfirmedDecisionIds(new Set());
      }
      if (options?.note !== undefined) setRecordingNote(options.note);
    },
    [persist],
  );

  const enterEmpty = useCallback((nextFlow: Flow) => {
    setShellModeState('empty');
    setSession(null);
    setDraft(null);
    setFlow(nextFlow);
    setConfirmedDecisionIds(new Set());
    setRecordingNote(null);
  }, []);

  const enterPlay = useCallback(
    (scenario: Scenario, nextFlow: Flow) => {
      const reconciled = reconcileDraft(nextFlow, scenario);
      const live = reconciled.draft;
      if (live !== scenario) {
        persist?.persistScenario(live);
      }
      const run = runScenario(nextFlow, live);
      const withLive = flowWithScenario(nextFlow, live);
      setShellModeState('play');
      setSession({
        run,
        name: live.name,
        flow: withLive,
        initialContext: live.initialContext,
      });
      setDraft(null);
      setFlow(withLive);
      setConfirmedDecisionIds(new Set());
      setRecordingNote(reconciled.note);
    },
    [persist],
  );

  const enterEdit = useCallback(
    (scenario: Scenario, nextFlow: Flow) => {
      const reconciled = reconcileDraft(nextFlow, scenario);
      const live = reconciled.draft;
      if (live !== scenario) {
        persist?.persistScenario(live);
      }
      const withLive = flowWithScenario(nextFlow, live);
      setShellModeState('edit');
      setDraft(live);
      setFlow(withLive);
      setSession(null);
      setConfirmedDecisionIds(new Set());
      setRecordingNote(reconciled.note);
      pause();
    },
    [persist, pause],
  );

  const startRecording = useCallback(
    (nextFlow: Flow, defaultName: string) => {
      const blank = createBlankScenario(nextFlow.scenarios, defaultName);
      persist?.persistScenario(blank);
      const withBlank = flowWithScenario(nextFlow, blank);
      setShellModeState('edit');
      setDraft(blank);
      setFlow(withBlank);
      setSession(null);
      setConfirmedDecisionIds(new Set());
      setRecordingNote(null);
      pause();
    },
    [persist, pause],
  );

  const setShellMode = useCallback(
    (mode: 'edit' | 'play') => {
      if (mode === 'play') {
        if (draft && flow) {
          enterPlay(draft, flow);
          return;
        }
        if (session) {
          setShellModeState('play');
        }
        return;
      }
      if (draft && flow) {
        setShellModeState('edit');
        pause();
        return;
      }
      if (session) {
        const scenario =
          session.flow.scenarios.find((s) => s.id === session.run.scenarioId) ??
          ({
            id: session.run.scenarioId,
            name: session.name,
            initialContext: session.initialContext,
            inputScript: [],
          } satisfies Scenario);
        enterEdit(scenario, session.flow);
      }
    },
    [draft, flow, session, enterPlay, enterEdit, pause],
  );

  const exit = useCallback(() => {
    setShellModeState(null);
    setSession(null);
    setDraft(null);
    setFlow(null);
    setConfirmedDecisionIds(new Set());
    setRecordingNote(null);
  }, []);

  const renameDraft = useCallback(
    (name: string) => {
      if (!draft || !flow || !name.trim()) return;
      writeDraft({ ...draft, name: name.trim() }, flow, { resetConfirmed: false });
    },
    [draft, flow, writeDraft],
  );

  const duplicateActive = useCallback(
    (nameFn: (name: string, existing: readonly Scenario[]) => string = duplicateScenarioName) => {
      const source = draft ?? session?.flow.scenarios.find((s) => s.id === session.run.scenarioId);
      const baseFlow = flow ?? session?.flow;
      if (!source || !baseFlow) return;
      const copy: Scenario = {
        ...structuredClone(source),
        id: uniqueScenarioId(baseFlow.scenarios),
        name: nameFn(source.name, baseFlow.scenarios),
      };
      persist?.persistScenario(copy);
      enterEdit(copy, flowWithScenario(baseFlow, copy));
    },
    [draft, session, flow, persist, enterEdit],
  );

  const deleteActive = useCallback(() => {
    const id = draft?.id ?? session?.run.scenarioId;
    const baseFlow = flow ?? session?.flow;
    if (!id || !baseFlow) return;
    persist?.removeScenario(id);
    const remaining = baseFlow.scenarios.filter((s) => s.id !== id);
    if (remaining.length === 0) {
      enterEmpty({ ...baseFlow, scenarios: [] });
      return;
    }
    const nextScenario = remaining[0];
    if (!nextScenario) {
      enterEmpty({ ...baseFlow, scenarios: [] });
      return;
    }
    enterPlay(nextScenario, { ...baseFlow, scenarios: remaining });
  }, [draft, session, flow, persist, enterEmpty, enterPlay]);

  const recordAction = useCallback(
    (actionId: string) => {
      if (!draft || !flow || !recording) return;
      const next = appendScreenStep(flow, draft, recording.head.nodeId, actionId);
      writeDraft(next, flow);
    },
    [draft, flow, recording, writeDraft],
  );

  const recordResult = useCallback(
    (result: string) => {
      if (!draft || !flow || !recording) return;
      const nodeType =
        recording.head.nodeType === 'external' || recording.head.nodeType === 'action'
          ? recording.head.nodeType
          : 'action';
      if (nodeType === 'action') {
        if (result !== 'success' && result !== 'error') return;
        writeDraft(
          appendResolutionStep(flow, draft, recording.head.nodeId, result, 'action'),
          flow,
        );
        return;
      }
      if (
        result !== 'success' &&
        result !== 'error' &&
        result !== 'denied' &&
        result !== 'cancelled'
      ) {
        return;
      }
      writeDraft(
        appendResolutionStep(flow, draft, recording.head.nodeId, result, 'external'),
        flow,
      );
    },
    [draft, flow, recording, writeDraft],
  );

  const continueDecision = useCallback(() => {
    const pending = recording?.pendingDecision;
    if (!pending) return;
    setConfirmedDecisionIds((prev) => {
      const next = new Set(prev);
      next.add(pending.nodeId);
      return next;
    });
  }, [recording]);

  const applyFix = useCallback(
    (fix: BranchFix, value?: unknown) => {
      if (!draft || !flow) return;
      const next = applyBranchFix(flow, draft, fix, value);
      writeDraft(next, flow);
    },
    [draft, flow, writeDraft],
  );

  const toggleExpectedOutcome = useCallback(
    (checked: boolean) => {
      if (!draft || !flow || !recording) return;
      const next = checked
        ? setExpectedOutcome(draft, recording.head.nodeId)
        : clearExpectedOutcome(draft);
      writeDraft(next, flow, { resetConfirmed: false });
    },
    [draft, flow, recording, writeDraft],
  );

  const editStepAction = useCallback(
    (scriptStepIndex: number, action: string) => {
      if (!draft || !flow) return;
      writeDraft(editStepChoice(flow, draft, scriptStepIndex, { action }), flow);
    },
    [draft, flow, writeDraft],
  );

  const editStepResult = useCallback(
    (scriptStepIndex: number, result: 'success' | 'error' | 'denied' | 'cancelled') => {
      if (!draft || !flow) return;
      writeDraft(editStepChoice(flow, draft, scriptStepIndex, { result }), flow);
    },
    [draft, flow, writeDraft],
  );

  const editStepPatch = useCallback(
    (scriptStepIndex: number, slot: string, value: unknown | null) => {
      if (!draft || !flow) return;
      const next =
        value === null
          ? clearStepPatch(flow, draft, scriptStepIndex, slot)
          : setStepPatch(flow, draft, scriptStepIndex, slot, value);
      writeDraft(next, flow);
    },
    [draft, flow, writeDraft],
  );

  const deleteFrom = useCallback(
    (scriptStepIndex: number) => {
      if (!draft || !flow) return;
      writeDraft(deleteFromStep(flow, draft, scriptStepIndex), flow);
    },
    [draft, flow, writeDraft],
  );

  const doneRecording = useCallback(() => {
    if (!draft || !flow) return;
    enterPlay(draft, flow);
  }, [draft, flow, enterPlay]);

  // Legacy enter() used by play-only call sites — maps to enterPlay.
  const enter = useCallback(
    (run: ScenarioRun, name: string, nextFlow: Flow, initialContext: Record<string, unknown>) => {
      const scenario =
        nextFlow.scenarios.find((s) => s.id === run.scenarioId) ??
        ({
          id: run.scenarioId,
          name,
          initialContext,
          inputScript: [],
        } satisfies Scenario);
      enterPlay(scenario, nextFlow);
    },
    [enterPlay],
  );

  return {
    shellMode,
    session,
    draft,
    flow,
    recording,
    steps,
    divergedIndex,
    divergence,
    recordingNote,
    enterEmpty,
    enterPlay,
    enterEdit,
    startRecording,
    setShellMode,
    exit,
    renameDraft,
    duplicateActive,
    deleteActive,
    recordAction,
    recordResult,
    continueDecision,
    applyFix,
    toggleExpectedOutcome,
    editStepAction,
    editStepResult,
    editStepPatch,
    deleteFrom,
    doneRecording,
    enter,
    ...player,
  };
}

function flowWithScenario(flow: Flow, scenario: Scenario): Flow {
  const has = flow.scenarios.some((s) => s.id === scenario.id);
  return {
    ...flow,
    scenarios: has
      ? flow.scenarios.map((s) => (s.id === scenario.id ? scenario : s))
      : [...flow.scenarios, scenario],
  };
}
