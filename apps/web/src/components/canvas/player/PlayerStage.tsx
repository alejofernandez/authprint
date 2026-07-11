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
import { ScreenFidelityView } from '../nodes/screen/ScreenFidelityView.tsx';
import { resolveScreenTheme } from '../nodes/screen/screenTheme.ts';
import { divergenceDetail, divergenceHeadline } from './divergenceCopy.ts';
import { isWarmOutcomeKind, nodeKindLabel } from './playerClipTone.ts';
import type { PlayerStep } from './steps.ts';
import { screenErrorBannerCopyForStep } from './steps.ts';

/** Scale mockup-tier screens for presentation legibility (verified ≥1.15 in stories). */
export const STAGE_PRESENTATION_SCALE = 1.2;

export type PlayerStageProps = {
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
};

export function PlayerStage({
  step,
  node,
  branding,
  editorTheme = 'light',
  flowTheme = 'light',
  isDiverged = false,
  divergence = null,
  flow,
  runTrace,
}: PlayerStageProps) {
  return (
    <div
      className="flex min-h-[320px] flex-1 items-center justify-center rounded-xl border border-border-subtle bg-bg-subtle/80 p-8 dark:border-border-default dark:bg-bg-subtle/40"
      data-stage-scale={STAGE_PRESENTATION_SCALE}
    >
      {isDiverged && divergence ? (
        <DivergenceStageCard divergence={divergence} />
      ) : (
        <StageContent
          step={step}
          node={node}
          branding={branding}
          editorTheme={editorTheme}
          flowTheme={flowTheme}
          flow={flow}
          runTrace={runTrace}
        />
      )}
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
}: {
  step: PlayerStep;
  node: Node;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  flow?: Flow;
  runTrace?: ScenarioRun['trace'];
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
        />
      );
    case 'decision':
    case 'action':
    case 'external':
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
}: {
  step: PlayerStep;
  node: ScreenNode;
  branding?: Branding;
  editorTheme: 'light' | 'dark';
  flowTheme: FlowTheme;
  flow?: Flow;
  runTrace?: ScenarioRun['trace'];
}) {
  const screenTheme = resolveScreenTheme(flowTheme, editorTheme);
  const errorBannerCopy =
    flow && runTrace
      ? (screenErrorBannerCopyForStep(flow, runTrace, step.index) ?? step.errorBannerCopy)
      : step.errorBannerCopy;
  return (
    <div
      className={`${screenTheme === 'dark' ? 'flow-theme-dark ' : ''}origin-center`}
      style={{ transform: `scale(${STAGE_PRESENTATION_SCALE})` }}
    >
      <div className="rounded-xl border border-border-default bg-bg-panel shadow-sm">
        <ScreenFidelityView
          node={node}
          branding={branding}
          errorBannerCopy={errorBannerCopy}
          stageLayout="player"
        />
      </div>
    </div>
  );
}

function InterstitialCard({
  step,
  node,
  accent,
}: {
  step: PlayerStep;
  node: Node;
  accent: 'decision' | 'action';
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

  return (
    <div className="w-[260px] rounded-xl border border-dashed border-border-default bg-bg-panel px-6 py-8 text-center shadow-sm dark:border-border-default dark:bg-bg-panel">
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

function DivergenceStageCard({ divergence }: { divergence: Divergence }) {
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
    </div>
  );
}
