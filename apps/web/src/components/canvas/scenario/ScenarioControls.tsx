'use client';

import type { ReactNode } from 'react';
import type { ScenarioModeValue } from './useScenarioRun.ts';

export function ScenarioControls({ scenario }: { scenario: ScenarioModeValue }) {
  const { session, stepIndex, isPlaying, atStart, atEnd, play, pause, step, back, reset, exit } =
    scenario;
  if (!session) return null;

  const { run, name } = session;
  const diverged = run.status === 'diverged';

  return (
    <div
      className={`absolute bottom-6 left-1/2 z-30 flex -translate-x-1/2 items-center gap-1 rounded-full border px-2 py-1.5 shadow-lg backdrop-blur ${
        diverged
          ? 'border-signal-error-border bg-signal-error-bg/95 text-signal-error-label dark:border-signal-error-border-strong dark:bg-signal-error-bg-muted dark:text-signal-error-label'
          : 'border-accent-primary-border-muted bg-bg-panel/95 text-accent-primary-fg-emphasis dark:border-accent-primary-border-muted dark:bg-bg-panel/90 dark:text-accent-primary-fg-on-bg'
      }`}
    >
      <span className="max-w-40 truncate px-2 text-sm font-medium">{name}</span>
      <span className="px-1 text-xs tabular-nums opacity-70">
        {stepIndex + 1}/{run.trace.length}
      </span>
      <ControlDivider />
      {isPlaying ? (
        <ControlButton label="Pause" onClick={pause}>
          ⏸
        </ControlButton>
      ) : (
        <ControlButton label="Play" onClick={play} disabled={atEnd && !diverged}>
          ▶
        </ControlButton>
      )}
      <ControlButton label="Step back" onClick={back} disabled={atStart}>
        ←
      </ControlButton>
      <ControlButton label="Step forward" onClick={step} disabled={atEnd}>
        →
      </ControlButton>
      <ControlButton label="Reset to start" onClick={reset}>
        ↺
      </ControlButton>
      <ControlDivider />
      <ControlButton label="Exit scenario mode" onClick={exit}>
        Exit
      </ControlButton>
    </div>
  );
}

function ControlDivider() {
  return <span className="mx-0.5 h-5 w-px bg-current opacity-20" aria-hidden="true" />;
}

function ControlButton({
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
      className="rounded-full px-2.5 py-1 text-sm disabled:cursor-not-allowed disabled:opacity-35 hover:bg-black/5 dark:hover:bg-white/10"
    >
      {children}
    </button>
  );
}
