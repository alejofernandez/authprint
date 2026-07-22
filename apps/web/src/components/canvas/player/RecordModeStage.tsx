'use client';

import { useTranslations } from 'next-intl';
import { useId, useLayoutEffect, useRef, useState } from 'react';
import { ScreenFidelityView } from '../nodes/screen/ScreenFidelityView.tsx';
import { PLAYER_ACTION_HIGHLIGHT_CLASS } from '../nodes/screen/screenActionHighlight.tsx';
import { resolveScreenTheme } from '../nodes/screen/screenTheme.ts';
import { isWarmOutcomeKind, nodeKindLabel } from './playerClipTone.ts';
import type { BranchFix, PendingDecision } from './recorder.ts';
import { actionExternalResults, nodeDisplayName, screenExitActions } from './screenExitActions.ts';
import type {
  RecordModeDecisionProps,
  RecordModeOutcomeProps,
  RecordModeResolveProps,
  RecordModeScreenProps,
} from './stageRecordTypes.ts';

function StageCaption({ children }: { children: React.ReactNode }) {
  return (
    <p className="mt-3 max-w-[280px] text-center text-xs leading-relaxed text-fg-subtle">
      {children}
    </p>
  );
}

function RecordGhostCard({
  accent,
  children,
  footer,
}: {
  accent: 'decision' | 'action';
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  const border =
    accent === 'decision'
      ? 'border-node-decision-border'
      : 'border-border-default dark:border-border-default';
  return (
    <div className="flex flex-col items-center">
      <div
        className={`w-[260px] rounded-xl border border-dashed ${border} bg-bg-panel px-6 py-8 text-center shadow-sm motion-reduce:transition-none transition-shadow duration-[var(--duration-fast)] ease-standard dark:bg-bg-panel`}
      >
        {children}
      </div>
      {footer}
    </div>
  );
}

function RecordSpinner() {
  return (
    <div
      className="mx-auto h-7 w-7 rounded-full border-[3px] border-border-subtle border-t-accent-primary-solid motion-reduce:animate-none animate-spin duration-[var(--duration-base)] dark:border-border-default dark:border-t-accent-primary"
      aria-hidden
    />
  );
}

// A bare `transform: scale()` doesn't affect layout: the frame paints past its
// box and occludes the action-chips row below on tall screens. Reserve the
// scaled footprint by measuring the unscaled content.
function PresentationScaleBlock({
  scale,
  className,
  children,
}: {
  scale: number;
  className?: string;
  children: React.ReactNode;
}) {
  const innerRef = useRef<HTMLDivElement>(null);
  const [size, setSize] = useState<{ w: number; h: number } | null>(null);

  useLayoutEffect(() => {
    const el = innerRef.current;
    if (!el) return;
    const update = () => setSize({ w: el.offsetWidth, h: el.offsetHeight });
    update();
    const observer = new ResizeObserver(update);
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      className="flex items-center justify-center"
      style={size ? { width: size.w * scale, height: size.h * scale } : undefined}
    >
      <div ref={innerRef} className={className} style={{ transform: `scale(${scale})` }}>
        {children}
      </div>
    </div>
  );
}

/** Screen at recording head — fidelity view + clickable exit actions. */
export function RecordModeScreenStage({
  node,
  flow,
  branding,
  editorTheme,
  flowTheme,
  immersive = false,
  onRecordAction,
  selectedActionId = null,
  editing = false,
}: RecordModeScreenProps) {
  const t = useTranslations('player.recordMode.screen');
  const screenTheme = resolveScreenTheme(flowTheme, editorTheme);
  const actions = screenExitActions(flow, node.id);

  return (
    <div className="flex flex-col items-center">
      <PresentationScaleBlock
        scale={immersive ? 1 : 1.2}
        className={`${screenTheme === 'dark' ? 'flow-theme-dark ' : ''}origin-center`}
      >
        <div className="rounded-xl border border-border-default bg-bg-panel shadow-sm">
          <ScreenFidelityView
            node={node}
            branding={branding}
            stageLayout="player"
            highlightedAction={editing ? selectedActionId : null}
          />
        </div>
      </PresentationScaleBlock>

      {actions.length > 0 ? (
        <div className="mt-3 flex max-w-[280px] flex-wrap justify-center gap-2">
          {actions.map((action) => (
            <RecordActionChip
              key={action.actionId}
              actionId={action.actionId}
              label={action.label}
              variant={actionChipVariant(action.highlightTarget)}
              selected={editing && action.actionId === selectedActionId}
              onSelect={onRecordAction}
            />
          ))}
        </div>
      ) : null}

      <StageCaption>
        {editing ? t('editCaption') : t('caption')}{' '}
        {actions.map((a, i) => (
          <span key={a.actionId}>
            {i > 0 ? ' / ' : null}
            <span className="font-mono text-fg-muted">{a.actionId}</span>
          </span>
        ))}
      </StageCaption>
    </div>
  );
}

function actionChipVariant(
  target: ReturnType<typeof screenExitActions>[number]['highlightTarget'],
): 'primary' | 'retreat' | 'default' {
  if (target === 'primary-cta' || target === 'passkey-field' || target === 'passkey-promotion') {
    return 'primary';
  }
  if (target === 'retreat') return 'retreat';
  return 'default';
}

function RecordActionChip({
  actionId,
  label,
  variant = 'default',
  selected = false,
  onSelect,
}: {
  actionId: string;
  label: string;
  variant?: 'primary' | 'retreat' | 'default';
  selected?: boolean;
  onSelect?: (actionId: string) => void;
}) {
  const variantCls =
    variant === 'primary'
      ? 'border-accent-primary-border bg-accent-primary-solid text-white hover:opacity-90'
      : variant === 'retreat'
        ? 'border-transparent bg-transparent text-fg-muted underline-offset-2 hover:underline'
        : 'border-border-default bg-bg-panel text-fg-default hover:shadow-sm';
  const selectedCls = selected
    ? 'ring-2 ring-accent-primary-border ring-offset-1 dark:ring-offset-bg-canvas'
    : '';

  return (
    <button
      type="button"
      onClick={() => onSelect?.(actionId)}
      aria-pressed={selected || undefined}
      className={`rounded-md border px-2.5 py-1 text-xs font-medium motion-reduce:transition-none transition-shadow duration-[var(--duration-fast)] ease-standard ${variantCls} ${selectedCls} ${variant !== 'retreat' ? PLAYER_ACTION_HIGHLIGHT_CLASS : ''}`}
      title={actionId}
    >
      {label}
    </button>
  );
}

export function RecordModeResolveStage({
  node,
  nodeType,
  flow,
  onRecordResult,
  selectedResult = null,
  editing = false,
}: RecordModeResolveProps) {
  const t = useTranslations('player.recordMode.resolve');
  const results = actionExternalResults(flow, node.id, nodeType);
  const kind = nodeKindLabel(node);

  return (
    <RecordGhostCard
      accent="action"
      footer={<StageCaption>{editing ? t('editCaption') : t('caption')}</StageCaption>}
    >
      {editing ? null : <RecordSpinner />}
      <div className={`text-sm font-semibold text-fg-default ${editing ? '' : 'mt-4'}`}>
        {nodeDisplayNameFromNode(node)}
      </div>
      {kind ? <div className="mt-1 text-xs text-fg-muted">{kind}</div> : null}
      {results.length > 0 ? (
        <div className="mt-4 flex flex-wrap justify-center gap-2">
          {results.map((result) => (
            <button
              key={result}
              type="button"
              onClick={() => onRecordResult?.(result)}
              aria-pressed={(editing && result === selectedResult) || undefined}
              className={`flex-1 rounded-md border px-3 py-1.5 text-xs font-medium motion-reduce:transition-none transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle ${resolveResultTone(result)} ${
                editing && result === selectedResult
                  ? 'border-accent-primary-border ring-2 ring-accent-primary-border ring-offset-1 dark:ring-offset-bg-canvas'
                  : 'border-border-default'
              }`}
            >
              {t(`result.${result}`)}
            </button>
          ))}
        </div>
      ) : (
        <p className="mt-4 text-xs leading-relaxed text-signal-warning-fg">{t('noEdges')}</p>
      )}
    </RecordGhostCard>
  );
}

function resolveResultTone(result: string): string {
  switch (result) {
    case 'success':
      return 'text-node-outcome-success-fg';
    case 'error':
      return 'text-signal-error-label dark:text-signal-error-fg';
    case 'denied':
    case 'cancelled':
      return 'text-fg-muted';
    default:
      return 'text-fg-default';
  }
}

export function RecordModeDecisionStage({
  pending,
  contextAtHead,
  flow,
  previousStepName,
  onContinueDecision,
  onApplyBranchFix,
}: RecordModeDecisionProps) {
  const t = useTranslations('player.recordMode.decision');
  const [showFixes, setShowFixes] = useState(!pending.dictated);
  const fixPanelId = useId();

  const slotValue = contextAtHead[pending.predicate.slot];
  const slotDisplay =
    slotValue === undefined || slotValue === null ? t('emptyValue') : String(slotValue);
  const takenLabel = pending.takenBranch ? t('branch.yes') : t('branch.no');
  const otherLabel = pending.otherBranch ? t('branch.yes') : t('branch.no');
  const takenDest = nodeDisplayName(flow, pending.takenDestinationId);
  const otherDest = nodeDisplayName(flow, pending.otherDestinationId);
  const decisionNode = flow.nodes.find((n) => n.id === pending.nodeId);
  const decisionName =
    decisionNode && 'name' in decisionNode && decisionNode.name
      ? decisionNode.name
      : pending.nodeId;

  return (
    <RecordGhostCard accent="decision" footer={<StageCaption>{t('caption')}</StageCaption>}>
      <div className="text-[11px] font-semibold uppercase tracking-wide text-node-decision-fg">
        {t('badge')}
      </div>
      <div className="mt-2 text-sm font-semibold text-fg-default">{decisionName}</div>
      <div className="mt-1 font-mono text-xs text-fg-muted">{pending.question}</div>
      {pending.dictated ? (
        <>
          <div className="mt-3 text-xs leading-relaxed text-fg-muted">
            {t('contextSays', { value: slotDisplay })}{' '}
            <span className="font-semibold text-node-decision-fg">{takenLabel}</span>
            <br />
            <span className="text-fg-subtle">&rarr; {takenDest}</span>
          </div>
          <button
            type="button"
            onClick={() => onContinueDecision?.()}
            className="mt-4 w-full rounded-md bg-accent-primary-solid px-3 py-2 text-sm font-medium text-white motion-reduce:transition-none transition-opacity duration-[var(--duration-fast)] ease-standard hover:opacity-90"
          >
            {t('continue', { branch: takenLabel })}
          </button>
          <button
            type="button"
            aria-expanded={showFixes}
            aria-controls={fixPanelId}
            onClick={() => setShowFixes((open) => !open)}
            className="mt-2 w-full rounded-md border border-border-default px-3 py-1.5 text-xs font-medium text-fg-muted motion-reduce:transition-none transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle"
          >
            {t('takeOther', { branch: otherLabel })}
          </button>
        </>
      ) : (
        <p className="mt-3 text-xs leading-relaxed text-fg-muted">
          {t('noValue', { slot: pending.predicate.slot })}
        </p>
      )}
      {showFixes ? (
        <div
          id={fixPanelId}
          className="mt-3 space-y-2 border-border-subtle border-t pt-3 text-left dark:border-border-default"
        >
          {pending.fixes.map((fix) => (
            <BranchFixOption
              key={`${fix.kind}-${fix.kind === 'step-patch' ? fix.stepIndex : fix.slot}`}
              fix={fix}
              otherBranch={otherLabel}
              otherDest={otherDest}
              previousStepName={previousStepName}
              onApply={onApplyBranchFix}
            />
          ))}
        </div>
      ) : null}
    </RecordGhostCard>
  );
}

function BranchFixOption({
  fix,
  otherBranch,
  otherDest,
  previousStepName,
  onApply,
}: {
  fix: BranchFix;
  otherBranch: string;
  otherDest: string;
  previousStepName?: string | null;
  onApply?: (fix: BranchFix) => void;
}) {
  const t = useTranslations('player.recordMode.decision.fix');

  if (fix.kind === 'needs-value') {
    return (
      <div className="rounded-md border border-border-subtle bg-bg-subtle px-2.5 py-2 text-xs text-fg-muted dark:border-border-default dark:bg-bg-subtle">
        <p>{t('needsValue', { slot: fix.slot, op: fix.op })}</p>
        <NeedsValuePrompt slot={fix.slot} op={fix.op} onApply={onApply} />
        <p className="mt-1 text-fg-subtle">
          {t('thenTakes', { branch: otherBranch, dest: otherDest })}
        </p>
      </div>
    );
  }

  const label =
    fix.kind === 'initial-context'
      ? t('initialContext', { slot: fix.slot, value: formatFixValue(fix.value) })
      : t('stepPatch', {
          slot: fix.slot,
          value: formatFixValue(fix.value),
          step: previousStepName ?? t('previousStep'),
        });

  return (
    <button
      type="button"
      onClick={() => onApply?.(fix)}
      className="w-full rounded-md border border-border-default bg-bg-panel px-2.5 py-2 text-left text-xs text-fg-default motion-reduce:transition-none transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle dark:hover:bg-bg-muted"
    >
      {label}
      <span className="mt-1 block text-fg-subtle">
        {t('thenTakes', { branch: otherBranch, dest: otherDest })}
      </span>
    </button>
  );
}

function NeedsValuePrompt({
  slot,
  op,
  onApply,
}: {
  slot: string;
  op: PendingDecision['predicate']['op'];
  onApply?: (fix: BranchFix) => void;
}) {
  const t = useTranslations('player.recordMode.decision.fix');
  const [draft, setDraft] = useState('');

  return (
    <div className="mt-2 flex gap-2">
      <input
        type="text"
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        placeholder={t('valuePlaceholder')}
        className="min-w-0 flex-1 rounded border border-border-default bg-bg-panel px-2 py-1 font-mono text-xs text-fg-default outline-none focus:border-accent-primary-border"
      />
      <button
        type="button"
        disabled={draft.trim().length === 0}
        onClick={() =>
          onApply?.({
            kind: 'initial-context',
            slot,
            value: parseDraftValue(draft, op),
          })
        }
        className="shrink-0 rounded border border-border-default px-2 py-1 text-xs font-medium text-fg-default disabled:opacity-40"
      >
        {t('apply')}
      </button>
    </div>
  );
}

function parseDraftValue(raw: string, op: PendingDecision['predicate']['op']): unknown {
  const trimmed = raw.trim();
  if (trimmed === 'true') return true;
  if (trimmed === 'false') return false;
  if (
    op === 'greater-than' ||
    op === 'less-than' ||
    op === 'greater-than-or-equal' ||
    op === 'less-than-or-equal'
  ) {
    const n = Number(trimmed);
    return Number.isNaN(n) ? trimmed : n;
  }
  return trimmed;
}

function formatFixValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  return String(value);
}

export function RecordModeOutcomeStage({
  step,
  node,
  expectOutcomeChecked = false,
  onToggleExpectedOutcome,
  onDone,
}: RecordModeOutcomeProps) {
  const t = useTranslations('player.recordMode.outcome');
  const checkboxId = useId();
  const kind = 'kind' in node ? node.kind : '';
  const warm = isWarmOutcomeKind(kind) || step.matchesExpectedOutcome === false;
  const success = !warm;

  return (
    <div className="flex flex-col items-center">
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
        <label
          htmlFor={checkboxId}
          className="mt-4 flex cursor-pointer items-center justify-center gap-2 text-xs text-fg-muted"
        >
          <input
            id={checkboxId}
            type="checkbox"
            checked={expectOutcomeChecked}
            onChange={(e) => onToggleExpectedOutcome?.(e.target.checked)}
            className="rounded border-border-default"
          />
          {t('expectCheckbox')}
        </label>
        <button
          type="button"
          onClick={() => onDone?.()}
          className="mt-4 w-full rounded-md bg-accent-primary-solid px-3 py-2 text-sm font-medium text-white motion-reduce:transition-none transition-opacity duration-[var(--duration-fast)] ease-standard hover:opacity-90"
        >
          {t('done')}
        </button>
      </div>
      <StageCaption>{t('caption')}</StageCaption>
    </div>
  );
}

function nodeDisplayNameFromNode(node: import('@authprint/dsl').Node): string {
  if ('name' in node && node.name) return node.name;
  if ('kind' in node && node.kind) return node.kind;
  return node.id;
}

export function RecordModeEntryStage() {
  const t = useTranslations('player.recordMode.entry');
  return (
    <div className="w-[260px] rounded-xl border border-dashed border-border-subtle bg-bg-panel px-6 py-10 text-center shadow-sm dark:border-border-default">
      <div className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
        {t('badge')}
      </div>
      <div className="mt-3 text-sm font-medium text-fg-default">{t('title')}</div>
    </div>
  );
}
