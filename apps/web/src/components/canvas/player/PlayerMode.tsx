'use client';

// US-110 — full-canvas player overlay: stage, context, transport, timeline.

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';
import { useMemo } from 'react';
import { useTheme } from '@/components/theme';
import { ContextPanel } from '../scenario/ContextPanel.tsx';
import { usePlayerModeContext } from './PlayerModeContext.tsx';
import { PlayerStage } from './PlayerStage.tsx';
import { TimelineStrip } from './TimelineStrip.tsx';
import { PLAYER_SPEEDS_SEC, type PlayerSpeed } from './usePlayer.ts';

export function PlayerMode() {
  const player = usePlayerModeContext();
  const { theme } = useTheme();
  const t = useTranslations('player');

  const resolvedEditorTheme: 'light' | 'dark' =
    theme === 'system'
      ? typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
        ? 'dark'
        : 'light'
      : theme;

  const session = player.session;
  const {
    steps,
    divergedIndex,
    index,
    playing,
    speed,
    atStart,
    atEnd,
    seek,
    next,
    prev,
    togglePlay,
    setSpeed,
  } = player;

  const activeStep = session ? steps[index] : undefined;
  const flow = session?.flow;
  const node = useMemo(() => {
    if (!activeStep || !flow) return null;
    return flow.nodes.find((n) => n.id === activeStep.nodeId) ?? null;
  }, [activeStep, flow]);

  if (!session || !activeStep || !node || !flow) return null;

  const { run, name, initialContext } = session;

  const isDivergedStep =
    divergedIndex !== null && index === divergedIndex && run.status === 'diverged';

  const context = run.contextSnapshots[index] ?? initialContext;
  const previousContext = index > 0 ? (run.contextSnapshots[index - 1] ?? null) : null;

  const decisionSlot =
    activeStep.nodeType === 'decision' && node.type === 'decision' ? node.predicate.slot : null;
  const emphasizedSlots = decisionSlot ? new Set([decisionSlot]) : undefined;

  return (
    <div
      className="absolute inset-0 z-40 flex flex-col bg-bg-canvas/97 backdrop-blur-sm dark:bg-bg-canvas/95"
      data-testid="player-mode"
    >
      <div className="flex min-h-0 flex-1 gap-4 p-4 pb-2">
        <div className="flex min-w-0 flex-1 flex-col">
          <div className="mb-2 truncate text-sm font-medium text-fg-muted">{name}</div>
          <PlayerStage
            step={activeStep}
            node={node}
            branding={flow.branding}
            editorTheme={resolvedEditorTheme}
            flowTheme={flow.branding?.theme ?? 'light'}
            isDiverged={isDivergedStep}
            divergence={isDivergedStep ? run.divergence : null}
            flow={flow}
            runTrace={run.trace}
          />
        </div>
        <ContextPanel
          embedded
          context={context}
          previousContext={previousContext}
          divergence={run.divergence}
          emphasizedSlots={emphasizedSlots}
        />
      </div>

      <PlayerTransport
        playing={playing}
        atStart={atStart}
        atEnd={atEnd}
        speed={speed}
        diverged={run.status === 'diverged'}
        onTogglePlay={togglePlay}
        onPrev={prev}
        onNext={next}
        onSpeedChange={setSpeed}
        onExit={player.exit}
        stepCurrent={index + 1}
        stepTotal={steps.length}
        labels={{
          stepBack: t('transport.stepBack'),
          stepForward: t('transport.stepForward'),
          play: t('transport.play'),
          pause: t('transport.pause'),
          speed: t('transport.speed'),
          speedOption: (seconds: number) => t('transport.speedOption', { seconds }),
          exit: t('transport.exit'),
        }}
      />

      <div className="shrink-0 border-border-subtle border-t px-4 pt-3 pb-4 dark:border-border-default">
        <TimelineStrip
          steps={steps}
          activeIndex={index}
          divergedIndex={divergedIndex}
          onSeek={seek}
        />
      </div>
    </div>
  );
}

type TransportLabels = {
  stepBack: string;
  stepForward: string;
  play: string;
  pause: string;
  speed: string;
  speedOption: (seconds: number) => string;
  exit: string;
};

function PlayerTransport({
  playing,
  atStart,
  atEnd,
  speed,
  diverged,
  onTogglePlay,
  onPrev,
  onNext,
  onSpeedChange,
  onExit,
  stepCurrent,
  stepTotal,
  labels,
}: {
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  speed: PlayerSpeed;
  diverged: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onSpeedChange: (speed: PlayerSpeed) => void;
  onExit: () => void;
  stepCurrent: number;
  stepTotal: number;
  labels: Omit<TransportLabels, 'stepCounter'>;
}) {
  return (
    <div
      className={`mx-4 mb-3 flex flex-wrap items-center justify-center gap-2 rounded-xl border px-3 py-2 shadow-sm ${
        diverged
          ? 'border-signal-error-border bg-signal-error-bg/90 dark:border-signal-error-border-strong dark:bg-signal-error-bg-muted'
          : 'border-border-subtle bg-bg-panel/95 dark:border-border-default dark:bg-bg-panel/90'
      }`}
    >
      <TransportButton label={labels.stepBack} onClick={onPrev} disabled={atStart}>
        ←
      </TransportButton>
      {playing ? (
        <TransportButton label={labels.pause} onClick={onTogglePlay}>
          ⏸
        </TransportButton>
      ) : (
        <TransportButton label={labels.play} onClick={onTogglePlay} disabled={atEnd && !diverged}>
          ▶
        </TransportButton>
      )}
      <TransportButton label={labels.stepForward} onClick={onNext} disabled={atEnd}>
        →
      </TransportButton>

      <span
        role="status"
        className="inline-flex w-[4.25rem] shrink-0 justify-center font-mono text-xs tabular-nums text-fg-muted"
        aria-live="polite"
        aria-label={`Step ${stepCurrent} of ${stepTotal}`}
      >
        <span className="inline-block w-[1.35rem] text-right">{stepCurrent}</span>
        <span className="px-0.5">/</span>
        <span className="inline-block w-[1.35rem] text-left">{stepTotal}</span>
      </span>

      <span className="mx-1 h-5 w-px bg-border-subtle dark:bg-border-default" aria-hidden />

      <label className="flex items-center gap-1.5 text-xs text-fg-muted">
        <span className="sr-only">{labels.speed}</span>
        <select
          value={speed}
          onChange={(e) => onSpeedChange(Number(e.target.value) as PlayerSpeed)}
          className="rounded-md border border-border-subtle bg-bg-panel px-2 py-1 text-xs text-fg-default dark:border-border-default"
          aria-label={labels.speed}
        >
          {PLAYER_SPEEDS_SEC.map((sec) => (
            <option key={sec} value={sec}>
              {labels.speedOption(sec)}
            </option>
          ))}
        </select>
      </label>

      <span className="mx-1 h-5 w-px bg-border-subtle dark:bg-border-default" aria-hidden />

      <TransportButton label={labels.exit} onClick={onExit}>
        {labels.exit}
      </TransportButton>
    </div>
  );
}

function TransportButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="rounded-lg px-2.5 py-1.5 text-sm disabled:cursor-not-allowed disabled:opacity-35 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
