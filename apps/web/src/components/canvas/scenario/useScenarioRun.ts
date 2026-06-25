// US-060 — scenario-mode run state. Holds the active `ScenarioRun` (from
// US-059's `runScenario`) plus a playback cursor over its trace, with
// play/step/back/reset. This is the seam the trace visualization (US-061) and
// the floating controls + Context panel (US-062) consume — they read the same
// state via the ScenarioMode context. `session === null` means edit mode.

import type { ScenarioRun } from '@authprint/dsl';
import { useCallback, useEffect, useState } from 'react';

// Auto-advance cadence when "play" walks the trace on its own.
const PLAY_INTERVAL_MS = 800;

/** Clamp a step index into `[0, traceLength-1]` (and `0` for an empty trace). */
export function clampStepIndex(index: number, traceLength: number): number {
  const last = Math.max(traceLength - 1, 0);
  return Math.min(Math.max(index, 0), last);
}

export type ScenarioSession = {
  run: ScenarioRun;
  name: string;
  initialContext: Record<string, unknown>;
};

export type ScenarioModeValue = {
  /** The running scenario, or `null` in edit mode. */
  session: ScenarioSession | null;
  /** Cursor along `session.run.trace`. */
  stepIndex: number;
  isPlaying: boolean;
  atStart: boolean;
  atEnd: boolean;
  enter: (run: ScenarioRun, name: string, initialContext: Record<string, unknown>) => void;
  exit: () => void;
  step: () => void;
  back: () => void;
  reset: () => void;
  play: () => void;
  pause: () => void;
};

export function useScenarioRun(): ScenarioModeValue {
  const [session, setSession] = useState<ScenarioSession | null>(null);
  const [stepIndex, setStepIndex] = useState(0);
  const [isPlaying, setIsPlaying] = useState(false);

  const traceLength = session?.run.trace.length ?? 0;
  const lastIndex = Math.max(traceLength - 1, 0);
  const atStart = stepIndex <= 0;
  const atEnd = stepIndex >= lastIndex;

  const enter = useCallback(
    (run: ScenarioRun, name: string, initialContext: Record<string, unknown>) => {
      setSession({ run, name, initialContext });
      setStepIndex(0);
      setIsPlaying(false);
    },
    [],
  );

  const exit = useCallback(() => {
    setSession(null);
    setStepIndex(0);
    setIsPlaying(false);
  }, []);

  const step = useCallback(() => {
    setStepIndex((i) => clampStepIndex(i + 1, traceLength));
  }, [traceLength]);

  const back = useCallback(() => {
    setIsPlaying(false);
    setStepIndex((i) => clampStepIndex(i - 1, traceLength));
  }, [traceLength]);

  const reset = useCallback(() => {
    setIsPlaying(false);
    setStepIndex(0);
  }, []);

  const play = useCallback(() => {
    // Replay from the start if we're already at the end.
    setStepIndex((i) => (i >= lastIndex ? 0 : i));
    setIsPlaying(true);
  }, [lastIndex]);

  const pause = useCallback(() => setIsPlaying(false), []);

  // While playing, advance one step per tick; the tick that lands on the last
  // step also stops playback (setState lives in the async callback, not the
  // effect body, so it doesn't cascade renders).
  useEffect(() => {
    if (!isPlaying || session === null || stepIndex >= lastIndex) return;
    const timer = setTimeout(() => {
      setStepIndex((i) => clampStepIndex(i + 1, traceLength));
      if (stepIndex + 1 >= lastIndex) setIsPlaying(false);
    }, PLAY_INTERVAL_MS);
    return () => clearTimeout(timer);
  }, [isPlaying, session, stepIndex, lastIndex, traceLength]);

  return {
    session,
    stepIndex,
    isPlaying,
    atStart,
    atEnd,
    enter,
    exit,
    step,
    back,
    reset,
    play,
    pause,
  };
}
