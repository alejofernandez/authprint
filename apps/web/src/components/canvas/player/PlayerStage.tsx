'use client';

import type {
  Branding,
  Divergence,
  Flow,
  FlowTheme,
  Node,
  ScenarioRun,
  ScreenNode,
} from '@authprint/dsl';
import { type ReactNode, useLayoutEffect, useRef, useState } from 'react';
import { ScreenFidelityView } from '../nodes/screen/ScreenFidelityView.tsx';
import { resolveScreenTheme } from '../nodes/screen/screenTheme.ts';
import { divergenceDetail, divergenceFocusNodeId, divergenceHeadline } from './divergenceCopy.ts';
import { isWarmOutcomeKind, nodeKindLabel } from './playerClipTone.ts';
import {
  RecordModeDecisionStage,
  RecordModeEntryStage,
  RecordModeOutcomeStage,
  RecordModeResolveStage,
  RecordModeScreenStage,
} from './RecordModeStage.tsx';
import type { PlayerStageRecordProps, PlayerStageViewProps } from './stageRecordTypes.ts';
import type { PlayerStep } from './steps.ts';
import { screenErrorBannerCopyForStep } from './steps.ts';

/** Scale mockup-tier screens for presentation legibility (verified ≥1.15 in stories). */
export const STAGE_PRESENTATION_SCALE = 1.2;

type PlayerStageSharedProps = {
  step: PlayerStep;
  node: Node;
  branding?: Branding;
  editorTheme?: 'light' | 'dark';
  flowTheme?: FlowTheme;
  isDiverged?: boolean;
  divergence?: Divergence | null;
  /** When set, screen error banners re-resolve from the live flow + trace. */
  flow?: Flow;
  runTrace?: ScenarioRun['trace'];
  /** Screen shown dimmed beneath a silent step overlay (action/external/decision). */
  backdropStep?: PlayerStep | null;
  backdropNode?: ScreenNode | null;
  /** Fill available height with minimal chrome — used by player mode. */
  immersive?: boolean;
  onRevealOnCanvas?: (nodeId: string) => void;
  revealLabel?: string;
};

export type PlayerStageProps = PlayerStageSharedProps &
  (PlayerStageViewProps | (Omit<PlayerStageRecordProps, 'mode'> & { mode: 'record' }));

export function PlayerStage(props: PlayerStageProps) {
  const {
    step,
    node,
    branding,
    editorTheme = 'light',
    flowTheme = 'light',
    isDiverged = false,
    divergence = null,
    flow,
    runTrace,
    backdropStep = null,
    backdropNode = null,
    immersive = false,
    onRevealOnCanvas,
    revealLabel,
  } = props;

  const isRecord = props.mode === 'record';

  const inner =
    isDiverged && divergence ? (
      <DivergenceStageCard
        divergence={divergence}
        onRevealOnCanvas={onRevealOnCanvas}
        revealLabel={revealLabel}
      />
    ) : isRecord ? (
      <RecordStageContent
        step={step}
        branding={branding}
        editorTheme={editorTheme}
        flowTheme={flowTheme}
        immersive={immersive}
        record={props}
      />
    ) : (
      <StageContent
        step={step}
        node={node}
        branding={branding}
        editorTheme={editorTheme}
        flowTheme={flowTheme}
        flow={flow}
        runTrace={runTrace}
        backdropStep={backdropStep}
        backdropNode={backdropNode}
        immersive={immersive}
      />
    );

  return (
    <div
      className={
        immersive
          ? 'flex h-full min-h-0 w-full flex-1 overflow-hidden'
          : 'flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-border-subtle bg-bg-subtle/80 p-8 dark:border-border-default dark:bg-bg-subtle/40'
      }
      data-stage-scale={STAGE_PRESENTATION_SCALE}
      data-stage-immersive={immersive || undefined}
      data-stage-mode={isRecord ? 'record' : 'view'}
    >
      {immersive && !(isDiverged && divergence) ? (
        <StagePresentationFrame>{inner}</StagePresentationFrame>
      ) : (
        inner
      )}
    </div>
  );
}

function RecordStageContent({
  step,
  branding,
  editorTheme,
  flowTheme,
  immersive,
  record,
}: {
  step: PlayerStep;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  immersive: boolean;
  record: Extract<PlayerStageProps, { mode: 'record' }>;
}) {
  const {
    flow,
    headNode,
    contextAtHead,
    pendingDecision,
    previousStepName,
    expectOutcomeChecked,
    onRecordAction,
    onRecordResult,
    onContinueDecision,
    onApplyBranchFix,
    onToggleExpectedOutcome,
    onDone,
  } = record;

  if (pendingDecision) {
    return (
      <RecordModeDecisionStage
        pending={pendingDecision}
        contextAtHead={contextAtHead}
        flow={flow}
        previousStepName={previousStepName}
        onContinueDecision={onContinueDecision}
        onApplyBranchFix={onApplyBranchFix}
      />
    );
  }

  switch (headNode.type) {
    case 'screen':
      return (
        <RecordModeScreenStage
          node={headNode}
          flow={flow}
          branding={branding}
          editorTheme={editorTheme}
          flowTheme={flowTheme}
          immersive={immersive}
          onRecordAction={onRecordAction}
        />
      );
    case 'action':
    case 'external':
      return (
        <RecordModeResolveStage
          node={headNode}
          nodeType={headNode.type}
          flow={flow}
          onRecordResult={onRecordResult}
        />
      );
    case 'outcome':
      return (
        <RecordModeOutcomeStage
          step={step}
          node={headNode}
          expectOutcomeChecked={expectOutcomeChecked}
          onToggleExpectedOutcome={onToggleExpectedOutcome}
          onDone={onDone}
        />
      );
    case 'entry':
      return <RecordModeEntryStage />;
    case 'decision':
      return null;
  }
}

function StagePresentationFrame({ children }: { children: ReactNode }) {
  const containerRef = useRef<HTMLDivElement>(null);
  const contentRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(STAGE_PRESENTATION_SCALE);

  useLayoutEffect(() => {
    const container = containerRef.current;
    const content = contentRef.current;
    if (!container || !content) return;

    const update = () => {
      const pad = 32;
      const cw = Math.max(container.clientWidth - pad, 0);
      const ch = Math.max(container.clientHeight - pad, 0);
      const bw = content.offsetWidth;
      const bh = content.offsetHeight;
      if (bw === 0 || bh === 0 || cw === 0 || ch === 0) return;
      const fit = Math.min(cw / bw, ch / bh, STAGE_PRESENTATION_SCALE);
      setScale((prev) => (Math.abs(prev - fit) < 0.001 ? prev : fit));
    };

    update();
    const observer = new ResizeObserver(update);
    observer.observe(container);
    observer.observe(content);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={containerRef}
      className="flex h-full min-h-0 w-full items-center justify-center overflow-hidden p-4"
    >
      <div className="origin-center" style={{ transform: `scale(${scale})` }}>
        <div ref={contentRef}>{children}</div>
      </div>
    </div>
  );
}

function StageContent({
  step,
  node,
  branding,
  editorTheme,
  flowTheme,
  flow,
  runTrace,
  backdropStep,
  backdropNode,
  immersive = false,
}: {
  step: PlayerStep;
  node: Node;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  flow?: Flow;
  runTrace?: ScenarioRun['trace'];
  backdropStep?: PlayerStep | null;
  backdropNode?: ScreenNode | null;
  immersive?: boolean;
}) {
  switch (step.nodeType) {
    case 'screen':
      return (
        <ScreenStageFrame
          step={step}
          node={node as ScreenNode}
          branding={branding}
          editorTheme={editorTheme}
          flowTheme={flowTheme}
          flow={flow}
          runTrace={runTrace}
          immersive={immersive}
        />
      );
    case 'decision':
    case 'action':
    case 'external':
      if (backdropStep && backdropNode) {
        return (
          <InterstitialOverlayStage
            step={step}
            node={node}
            accent={step.nodeType === 'decision' ? 'decision' : 'action'}
            backdropNode={backdropNode}
            branding={branding}
            editorTheme={editorTheme}
            flowTheme={flowTheme}
            immersive={immersive}
          />
        );
      }
      return (
        <InterstitialCard
          step={step}
          node={node}
          accent={step.nodeType === 'decision' ? 'decision' : 'action'}
        />
      );
    case 'outcome':
      return <OutcomeEndCard step={step} node={node} />;
    case 'entry':
      return <EntryStartCard />;
  }
}

function ScreenStageFrame({
  step,
  node,
  branding,
  editorTheme,
  flowTheme,
  flow,
  runTrace,
  immersive = false,
}: {
  step: PlayerStep;
  node: ScreenNode;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  flow?: Flow;
  runTrace?: ScenarioRun['trace'];
  immersive?: boolean;
}) {
  const screenTheme = resolveScreenTheme(flowTheme, editorTheme);
  const errorBannerCopy =
    flow && runTrace
      ? (screenErrorBannerCopyForStep(flow, runTrace, step.index) ?? step.errorBannerCopy)
      : step.errorBannerCopy;
  return (
    <div
      className={`${screenTheme === 'dark' ? 'flow-theme-dark ' : ''}origin-center`}
      style={immersive ? undefined : { transform: `scale(${STAGE_PRESENTATION_SCALE})` }}
    >
      <div className="rounded-xl border border-border-default bg-bg-panel shadow-sm">
        <ScreenFidelityView
          node={node}
          branding={branding}
          errorBannerCopy={errorBannerCopy}
          stageLayout="player"
          highlightedAction={step.exitActionId}
          highlightedActionLabel={step.exitTriggerLabel}
        />
      </div>
    </div>
  );
}

function InterstitialOverlayStage({
  step,
  node,
  accent,
  backdropNode,
  branding,
  editorTheme,
  flowTheme,
  immersive = false,
}: {
  step: PlayerStep;
  node: Node;
  accent: 'decision' | 'action';
  backdropNode: ScreenNode;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  immersive?: boolean;
}) {
  const screenTheme = resolveScreenTheme(flowTheme, editorTheme);

  return (
    <div
      className={`${screenTheme === 'dark' ? 'flow-theme-dark ' : ''}relative inline-block origin-center`}
      style={immersive ? undefined : { transform: `scale(${STAGE_PRESENTATION_SCALE})` }}
      data-stage-overlay
    >
      <div
        className="pointer-events-none select-none rounded-xl border border-border-default bg-bg-panel opacity-55 shadow-sm saturate-[0.88]"
        aria-hidden
      >
        <ScreenFidelityView
          node={backdropNode}
          branding={branding}
          errorBannerCopy={null}
          stageLayout="player"
        />
      </div>
      <div className="absolute inset-0 flex items-center justify-center rounded-xl bg-bg-canvas/25 dark:bg-bg-canvas/45">
        <InterstitialCard step={step} node={node} accent={accent} variant="overlay" />
      </div>
    </div>
  );
}

function InterstitialCard({
  step,
  node,
  accent,
  variant = 'standalone',
}: {
  step: PlayerStep;
  node: Node;
  accent: 'decision' | 'action';
  variant?: 'standalone' | 'overlay';
}) {
  const accentText =
    accent === 'decision'
      ? 'text-node-decision-fg'
      : 'text-accent-primary-fg-emphasis dark:text-accent-primary-fg-on-bg';
  const detail =
    step.nodeType === 'decision'
      ? step.decisionQuestion
      : (nodeKindLabel(node) ?? step.displayName);
  const resolution =
    step.nodeType === 'decision'
      ? step.decisionBranch === true
        ? 'yes'
        : step.decisionBranch === false
          ? 'no'
          : null
      : step.resolution;

  const overlay = variant === 'overlay';

  return (
    <div
      className={
        overlay
          ? 'w-[200px] rounded-xl border border-dashed border-border-default bg-bg-panel/95 px-4 py-6 text-center shadow-md backdrop-blur-[2px] dark:border-border-default dark:bg-bg-panel/95'
          : 'w-[260px] rounded-xl border border-dashed border-border-default bg-bg-panel px-6 py-8 text-center shadow-sm dark:border-border-default dark:bg-bg-panel'
      }
    >
      <StageSpinner />
      <div className="mt-4 text-sm font-semibold text-fg-default">{step.displayName}</div>
      {detail ? <div className="mt-1 text-xs text-fg-muted">{detail}</div> : null}
      {resolution ? (
        <div className={`mt-3 text-xs font-medium ${accentText}`}>&rarr; {resolution}</div>
      ) : null}
    </div>
  );
}

function StageSpinner() {
  return (
    <div
      className="mx-auto h-7 w-7 rounded-full border-[3px] border-border-subtle border-t-accent-primary-solid motion-reduce:animate-none animate-spin duration-[var(--duration-base)] dark:border-border-default dark:border-t-accent-primary"
      aria-hidden
    />
  );
}

function OutcomeEndCard({ step, node }: { step: PlayerStep; node: Node }) {
  const kind = 'kind' in node ? node.kind : '';
  const warm = isWarmOutcomeKind(kind) || step.matchesExpectedOutcome === false;
  const success = !warm;

  return (
    <div
      className={
        success
          ? 'w-[260px] rounded-xl border border-node-outcome-success-border bg-node-outcome-success-bg px-6 py-10 text-center'
          : 'w-[260px] rounded-xl border border-signal-error-border bg-signal-error-bg px-6 py-10 text-center dark:border-signal-error-border-strong dark:bg-signal-error-bg-muted'
      }
    >
      <div
        className={
          success
            ? 'mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-node-outcome-bg text-xl text-node-outcome-success-fg'
            : 'mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-signal-error-bg text-xl text-signal-danger dark:text-signal-danger-fg'
        }
      >
        {success ? '✓' : '!'}
      </div>
      <div
        className={`mt-4 text-sm font-semibold ${success ? 'text-node-outcome-success-fg' : 'text-signal-error-label dark:text-signal-error-fg'}`}
      >
        {step.displayName}
      </div>
      <div className="mt-1 text-xs text-fg-muted">
        {success ? 'Expected outcome reached' : 'Unexpected or error outcome'}
      </div>
    </div>
  );
}

function EntryStartCard() {
  return (
    <div className="w-[260px] rounded-xl border border-border-subtle bg-bg-panel px-6 py-10 text-center shadow-sm dark:border-border-default">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">Entry</div>
      <div className="mt-3 text-sm font-medium text-fg-default">Session starts</div>
    </div>
  );
}

function DivergenceStageCard({
  divergence,
  onRevealOnCanvas,
  revealLabel,
}: {
  divergence: Divergence;
  onRevealOnCanvas?: (nodeId: string) => void;
  revealLabel?: string;
}) {
  const focusNodeId = divergenceFocusNodeId(divergence);

  return (
    <div className="w-[300px] rounded-xl border border-signal-danger-ring bg-signal-error-bg px-6 py-8 text-center dark:border-signal-danger dark:bg-signal-error-bg-muted">
      <div className="text-xs font-semibold uppercase tracking-wide text-signal-danger dark:text-signal-danger-fg">
        Diverged
      </div>
      <div className="mt-3 text-sm font-semibold text-signal-error-label dark:text-signal-error-fg">
        {divergenceHeadline(divergence)}
      </div>
      <div className="mt-2 text-xs leading-relaxed text-fg-muted dark:text-fg-subtle">
        {divergenceDetail(divergence)}
      </div>
      {onRevealOnCanvas && revealLabel && focusNodeId ? (
        <button
          type="button"
          onClick={() => onRevealOnCanvas(focusNodeId)}
          className="mt-4 rounded-md border border-signal-danger-ring px-3 py-1.5 text-xs font-medium text-signal-error-label hover:bg-signal-error-bg/80 dark:border-signal-danger dark:text-signal-error-fg dark:hover:bg-signal-error-bg-muted/80"
        >
          {revealLabel}
        </button>
      ) : null}
    </div>
  );
}
