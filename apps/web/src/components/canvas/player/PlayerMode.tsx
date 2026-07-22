'use client';

// US-110 / US-120 — player overlay: Play + Edit shell, empty state, scenario CRUD.

import type { Scenario } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useMemo, useRef, useState } from 'react';
import { useTheme } from '@/components/theme';
import { ContextPanel } from '../scenario/ContextPanel.tsx';
import { buildEditableScriptStep } from './editStepMapping.ts';
import { FocusedStepControls } from './FocusedStepControls.tsx';
import { usePlayerModeContext } from './PlayerModeContext.tsx';
import { PlayerStage, StagePresentationFrame } from './PlayerStage.tsx';
import { PlayerTransportDock, PlayerTransportPill } from './PlayerTransport.tsx';
import { RecordModeResolveStage, RecordModeScreenStage } from './RecordModeStage.tsx';
import { ScenarioDeleteConfirmDialog } from './ScenarioDeleteConfirmDialog.tsx';
import { nodeDisplayName } from './screenExitActions.ts';
import { isSilentPlayerStep, lastScreenStepIndex } from './steps.ts';
import { TimelineStrip } from './TimelineStrip.tsx';

export function PlayerMode({
  onRevealOnCanvas,
  onNewScenario,
}: {
  onRevealOnCanvas?: (nodeId: string) => void;
  onNewScenario?: () => void;
}) {
  const player = usePlayerModeContext();
  const { theme } = useTheme();
  const t = useTranslations('player');
  const [contextOpen, setContextOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  // UF-016 — which player step is focused for in-place editing; null = recording head.
  const [focusIndex, setFocusIndex] = useState<number | null>(null);
  // UF-023 — the reroute warning floats once per edit session; dismissing it
  // hides it until edit mode closes.
  const [rerouteWarningDismissed, setRerouteWarningDismissed] = useState(false);
  const previewRef = useRef<HTMLDivElement>(null);

  const resolvedEditorTheme: 'light' | 'dark' =
    theme === 'system'
      ? typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
      : theme;

  const {
    shellMode,
    session,
    draft,
    flow,
    recording,
    steps,
    divergedIndex,
    index,
    playing,
    atStart,
    atEnd,
    seek,
    next,
    prev,
    togglePlay,
    pause,
  } = player;

  // Focus resets when the scenario changes and can't outlive a shrunken strip
  // (delete-from-here, tail-drop). Adjusted during render — React's
  // "adjusting state when props change" pattern, no effect round-trip.
  const draftId = draft?.id ?? null;
  const [focusDraftId, setFocusDraftId] = useState(draftId);
  if (focusDraftId !== draftId) {
    setFocusDraftId(draftId);
    setFocusIndex(null);
  } else if (focusIndex !== null && focusIndex >= steps.length) {
    setFocusIndex(null);
  }
  if (shellMode !== 'edit' && rerouteWarningDismissed) {
    setRerouteWarningDismissed(false);
  }

  if (!shellMode || !flow) return null;

  if (shellMode === 'empty') {
    return (
      <div className="absolute inset-0 z-40 flex flex-col bg-bg-canvas" data-testid="player-mode">
        <div className="relative flex min-h-0 flex-1 items-center justify-center p-6">
          <div className="w-full max-w-sm rounded-xl border border-border-subtle bg-bg-panel p-8 text-center shadow-sm dark:border-border-default">
            <p className="text-base font-semibold text-fg-default">{t('empty.title')}</p>
            <p className="mt-2 text-sm text-fg-subtle">{t('empty.body')}</p>
            <button
              type="button"
              className="mt-6 rounded-lg bg-accent-primary-solid px-4 py-2 text-sm font-medium text-white transition-colors duration-[var(--duration-fast)] ease-standard hover:brightness-110 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
              onClick={() => onNewScenario?.()}
            >
              {t('empty.cta')}
            </button>
          </div>
          <button
            type="button"
            aria-label={t('transport.exit')}
            onClick={player.exit}
            className="absolute top-3 right-3 rounded-lg border border-border-subtle bg-bg-panel/95 px-2.5 py-1.5 text-sm text-fg-muted shadow-lg backdrop-blur hover:bg-bg-subtle dark:border-border-default"
          >
            ×
          </button>
        </div>
      </div>
    );
  }

  const isEdit = shellMode === 'edit';
  const activeName = isEdit ? (draft?.name ?? '') : (session?.name ?? '');
  const activeScenarioId = isEdit ? (draft?.id ?? '') : (session?.run.scenarioId ?? '');

  return (
    <div className="absolute inset-0 z-40 flex flex-col bg-bg-canvas" data-testid="player-mode">
      <div ref={previewRef} className="relative min-h-0 flex-1 overflow-hidden">
        {isEdit && draft ? (
          <EditChrome
            flow={flow}
            draft={draft}
            recording={recording}
            steps={steps}
            editorTheme={resolvedEditorTheme}
            previousStepName={steps.length > 1 ? steps[steps.length - 2]?.displayName : undefined}
            focusIndex={focusIndex}
            onClearFocus={() => setFocusIndex(null)}
            rerouteWarningDismissed={rerouteWarningDismissed}
            onDismissRerouteWarning={() => setRerouteWarningDismissed(true)}
          />
        ) : session ? (
          <PlayChrome
            session={session}
            steps={steps}
            divergedIndex={divergedIndex}
            index={index}
            contextOpen={contextOpen}
            setContextOpen={setContextOpen}
            editorTheme={resolvedEditorTheme}
            onRevealOnCanvas={onRevealOnCanvas}
          />
        ) : null}

        {!isEdit ? (
          <PlayerTransportPill
            boundsRef={previewRef}
            name={activeName}
            scenarios={flow.scenarios}
            activeScenarioId={activeScenarioId}
            onSelectScenario={(scenario: Scenario) => player.enterPlay(scenario, flow)}
            playing={playing}
            atStart={atStart}
            atEnd={atEnd}
            diverged={session?.run.status === 'diverged'}
            onTogglePlay={togglePlay}
            onPrev={prev}
            onNext={next}
            onExit={player.exit}
            stepCurrent={index + 1}
            stepTotal={Math.max(steps.length, 1)}
            mode="play"
            onSetMode={(m) => player.setShellMode(m)}
            modeLabels={{ edit: t('mode.edit'), play: t('mode.play') }}
            onNewScenario={onNewScenario}
            newScenarioLabel={t('scenarioPicker.new')}
            labels={{
              stepBack: t('transport.stepBack'),
              stepForward: t('transport.stepForward'),
              play: t('transport.play'),
              pause: t('transport.pause'),
              exit: t('transport.exit'),
              scenarioPickerOpen: t('scenarioPicker.open'),
              scenarioPickerCurrent: t('scenarioPicker.current'),
              dragHandle: t('transport.dragHandle'),
              collapse: t('transport.collapse'),
              expand: t('transport.expand'),
            }}
          />
        ) : null}
      </div>

      {isEdit && draft ? (
        <PlayerTransportDock
          name={activeName}
          mode="edit"
          onSetMode={(m) => player.setShellMode(m)}
          modeLabels={{ edit: t('mode.edit'), play: t('mode.play') }}
          editManage={{
            scenarioId: draft.id,
            onCommitName: (name) => player.renameDraft(name),
            onDuplicate: () => player.duplicateActive(),
            onRequestDelete: () => setDeleteOpen(true),
            labels: {
              panelTitle: t('scenarioCrud.panelTitle'),
              nameLabel: t('scenarioCrud.nameLabel'),
              duplicate: t('scenarioCrud.duplicate'),
              delete: t('scenarioCrud.delete'),
              close: t('scenarioCrud.close'),
            },
          }}
          onExit={player.exit}
          exitLabel={t('transport.exit')}
        />
      ) : null}

      <div className="shrink-0 border-border-subtle border-t px-3 pt-2 pb-3 dark:border-border-default">
        {isEdit && draft && recording ? (
          <TimelineStrip
            mode="edit"
            steps={steps}
            activeIndex={focusIndex ?? Math.max(steps.length - 1, 0)}
            flow={flow}
            draft={draft}
            ghostNextName={
              recording.head.nodeType !== 'outcome'
                ? nodeDisplayName(flow, recording.head.nodeId)
                : null
            }
            onFocusStep={setFocusIndex}
            onScrubBegin={pause}
            onSeek={seek}
          />
        ) : (
          <TimelineStrip
            steps={steps}
            activeIndex={index}
            divergedIndex={divergedIndex}
            onScrubBegin={pause}
            onSeek={seek}
            onRevealOnCanvas={onRevealOnCanvas}
            revealLabel={t('revealOnCanvas')}
          />
        )}
      </div>

      <ScenarioDeleteConfirmDialog
        open={deleteOpen}
        onOpenChange={setDeleteOpen}
        scenarioName={activeName}
        onConfirm={() => player.deleteActive()}
      />
    </div>
  );
}

function EditChrome({
  flow,
  draft,
  recording,
  steps,
  editorTheme,
  previousStepName,
  focusIndex,
  onClearFocus,
  rerouteWarningDismissed,
  onDismissRerouteWarning,
}: {
  flow: NonNullable<ReturnType<typeof usePlayerModeContext>['flow']>;
  draft: Scenario;
  recording: NonNullable<ReturnType<typeof usePlayerModeContext>['recording']> | null;
  steps: ReturnType<typeof usePlayerModeContext>['steps'];
  editorTheme: 'light' | 'dark';
  previousStepName?: string;
  focusIndex: number | null;
  onClearFocus: () => void;
  rerouteWarningDismissed: boolean;
  onDismissRerouteWarning: () => void;
}) {
  const player = usePlayerModeContext();
  const t = useTranslations('player');

  const headNode = useMemo(() => {
    if (!recording) return null;
    return flow.nodes.find((n) => n.id === recording.head.nodeId) ?? null;
  }, [flow, recording]);

  const activeStep = steps[Math.max(steps.length - 1, 0)];

  // UF-016 — focused step, rebuilt from the live draft every render so an
  // applied edit reads back immediately.
  const focusedEditable =
    focusIndex !== null ? buildEditableScriptStep(flow, draft, steps, focusIndex) : null;
  const focusedNode = focusedEditable
    ? (flow.nodes.find((n) => n.id === focusedEditable.step.nodeId) ?? null)
    : null;

  if (!recording || !headNode || !activeStep) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-fg-subtle">
        {t('edit.loading')}
      </div>
    );
  }

  return (
    <div className="flex h-full">
      <div className="relative min-w-0 flex-1">
        {player.recordingNote ? (
          <div className="absolute top-3 left-3 z-20 max-w-sm rounded-lg bg-signal-warning-bg px-3 py-2 text-xs text-signal-warning-label">
            {player.recordingNote}
          </div>
        ) : null}
        {focusedEditable && focusedNode ? (
          <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-accent-primary-border bg-accent-primary-bg px-3 py-1 text-xs font-medium text-accent-primary-fg-emphasis">
            {t('edit.editingStep', { index: focusIndex !== null ? focusIndex + 1 : 0 })}
          </div>
        ) : (
          <div className="absolute top-3 left-1/2 z-20 flex -translate-x-1/2 items-center gap-2 rounded-full border border-signal-error-border bg-signal-error-bg px-3 py-1 text-xs font-medium text-signal-error-label">
            <span
              className="h-2 w-2 rounded-full bg-signal-error-label motion-reduce:animate-none animate-pulse"
              aria-hidden
            />
            {t('edit.recording')}
          </div>
        )}
        {focusedEditable && focusedNode && !rerouteWarningDismissed ? (
          <div
            role="status"
            className="absolute bottom-3 left-1/2 z-20 flex max-w-md -translate-x-1/2 items-center gap-2 rounded-lg bg-signal-warning-bg px-3 py-2 text-xs leading-relaxed text-signal-warning-label shadow-lg"
          >
            <span>
              {t('stepEditor.scripted.rerouteWarning', {
                target:
                  focusedEditable.kind === 'screen'
                    ? t('stepEditor.scripted.rerouteAction')
                    : t('stepEditor.scripted.rerouteResult'),
              })}
            </span>
            <button
              type="button"
              aria-label={t('edit.dismissWarning')}
              onClick={onDismissRerouteWarning}
              className="shrink-0 rounded p-0.5 hover:bg-black/10 dark:hover:bg-white/10"
            >
              ✕
            </button>
          </div>
        ) : null}
        {focusedEditable && focusedNode ? (
          <div className="flex h-full min-h-0 w-full flex-1 overflow-hidden">
            <StagePresentationFrame>
              {/* Controls float beside the stage: stacking below grows the
                  frame and shrinks the fit-scale (UF-022). */}
              <div className="flex items-center gap-4">
                {focusedEditable.kind === 'screen' && focusedNode.type === 'screen' ? (
                  <RecordModeScreenStage
                    node={focusedNode}
                    flow={flow}
                    branding={flow.branding}
                    editorTheme={editorTheme}
                    flowTheme={flow.branding?.theme ?? 'light'}
                    immersive
                    editing
                    selectedActionId={focusedEditable.step.action}
                    onRecordAction={(actionId) =>
                      player.editStepAction(focusedEditable.scriptStepIndex, actionId)
                    }
                  />
                ) : focusedEditable.kind !== 'screen' &&
                  (focusedNode.type === 'action' || focusedNode.type === 'external') ? (
                  <RecordModeResolveStage
                    node={focusedNode}
                    nodeType={focusedNode.type}
                    flow={flow}
                    editing
                    selectedResult={focusedEditable.step.result}
                    onRecordResult={(result) =>
                      player.editStepResult(
                        focusedEditable.scriptStepIndex,
                        result as 'success' | 'error' | 'denied' | 'cancelled',
                      )
                    }
                  />
                ) : null}
                <FocusedStepControls
                  className="w-[300px] shrink-0"
                  editable={focusedEditable}
                  contextSlots={flow.context}
                  onSetPatchChange={(slot, value) =>
                    player.editStepPatch(focusedEditable.scriptStepIndex, slot, value)
                  }
                  onDeleteFromHere={() => {
                    player.deleteFrom(focusedEditable.scriptStepIndex);
                    onClearFocus();
                  }}
                  onBackToRecording={onClearFocus}
                />
              </div>
            </StagePresentationFrame>
          </div>
        ) : (
          <PlayerStage
            immersive
            mode="record"
            step={activeStep}
            node={headNode}
            branding={flow.branding}
            editorTheme={editorTheme}
            flowTheme={flow.branding?.theme ?? 'light'}
            flow={flow}
            headNode={headNode}
            contextAtHead={recording.contextAtHead}
            pendingDecision={recording.pendingDecision ?? undefined}
            previousStepName={previousStepName}
            expectOutcomeChecked={Boolean(draft.expectedOutcome?.outcomeId)}
            onRecordAction={player.recordAction}
            onRecordResult={player.recordResult}
            onContinueDecision={player.continueDecision}
            onApplyBranchFix={player.applyFix}
            onToggleExpectedOutcome={player.toggleExpectedOutcome}
            onDone={player.doneRecording}
          />
        )}
      </div>
    </div>
  );
}

function PlayChrome({
  session,
  steps,
  divergedIndex,
  index,
  contextOpen,
  setContextOpen,
  editorTheme,
  onRevealOnCanvas,
}: {
  session: NonNullable<ReturnType<typeof usePlayerModeContext>['session']>;
  steps: ReturnType<typeof usePlayerModeContext>['steps'];
  divergedIndex: number | null;
  index: number;
  contextOpen: boolean;
  setContextOpen: (open: boolean | ((v: boolean) => boolean)) => void;
  editorTheme: 'light' | 'dark';
  onRevealOnCanvas?: (nodeId: string) => void;
}) {
  const t = useTranslations('player');
  const { run, flow, initialContext } = session;
  const activeStep = steps[index];
  const node = useMemo(() => {
    if (!activeStep) return null;
    return flow.nodes.find((n) => n.id === activeStep.nodeId) ?? null;
  }, [activeStep, flow]);

  const backdrop = useMemo(() => {
    if (!activeStep || !isSilentPlayerStep(activeStep.nodeType)) return null;
    const screenIndex = lastScreenStepIndex(steps, index);
    if (screenIndex === null) return null;
    const backdropStep = steps[screenIndex];
    const backdropNode = flow.nodes.find((n) => n.id === backdropStep?.nodeId);
    if (!backdropStep || backdropNode?.type !== 'screen') return null;
    return { step: backdropStep, node: backdropNode };
  }, [activeStep, flow, steps, index]);

  if (!activeStep || !node) return null;

  const isDivergedStep =
    divergedIndex !== null && index === divergedIndex && run.status === 'diverged';

  const context = run.contextSnapshots[index] ?? initialContext;
  const previousContext = index > 0 ? (run.contextSnapshots[index - 1] ?? null) : null;
  const decisionSlot =
    activeStep.nodeType === 'decision' && node.type === 'decision' ? node.predicate.slot : null;
  const emphasizedSlots = decisionSlot ? new Set([decisionSlot]) : undefined;

  return (
    <>
      <button
        type="button"
        aria-expanded={contextOpen}
        aria-controls="player-context-drawer"
        onClick={() => setContextOpen((open) => !open)}
        className={`absolute top-3 right-3 z-30 flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-sm shadow-lg backdrop-blur transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border ${
          contextOpen
            ? 'border-accent-primary-border bg-bg-panel text-accent-primary-fg-emphasis dark:border-accent-primary-border dark:bg-bg-panel dark:text-accent-primary-fg-on-bg'
            : 'border-border-subtle bg-bg-panel/95 text-fg-muted dark:border-border-default dark:bg-bg-panel/95'
        }`}
      >
        {t('context.toggle')}
      </button>

      {contextOpen ? (
        <aside
          id="player-context-drawer"
          className="absolute top-0 right-0 z-50 flex h-full w-72 flex-col border-border-subtle border-l bg-bg-panel/98 shadow-xl backdrop-blur dark:border-border-default dark:bg-bg-panel/98"
        >
          <div className="flex shrink-0 items-center justify-between border-border-subtle border-b px-3 py-2.5 dark:border-border-default">
            <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
              {t('context.title')}
            </span>
            <button
              type="button"
              aria-label={t('context.close')}
              onClick={() => setContextOpen(false)}
              className="rounded-md px-2 py-1 text-sm text-fg-muted hover:bg-black/5 dark:hover:bg-white/10"
            >
              ×
            </button>
          </div>
          <div className="flex min-h-0 flex-1 flex-col overflow-auto p-3">
            <ContextPanel
              drawer
              context={context}
              previousContext={previousContext}
              divergence={run.divergence}
              emphasizedSlots={emphasizedSlots}
            />
          </div>
        </aside>
      ) : null}

      <PlayerStage
        immersive
        step={activeStep}
        node={node}
        branding={flow.branding}
        editorTheme={editorTheme}
        flowTheme={flow.branding?.theme ?? 'light'}
        isDiverged={isDivergedStep}
        divergence={isDivergedStep ? run.divergence : null}
        flow={flow}
        runTrace={run.trace}
        backdropStep={backdrop?.step ?? null}
        backdropNode={backdrop?.node ?? null}
        onRevealOnCanvas={onRevealOnCanvas}
        revealLabel={t('revealOnCanvas')}
      />
    </>
  );
}
