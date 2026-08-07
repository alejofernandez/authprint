// US-107 — headless playback state for the scenario player (no UI).
// FS-01 — Screen steps can hold autoplay until the interaction film completes.

import { useCallback, useEffect, useState } from 'react';
import type { PlayerStep } from './steps.ts';

export const PLAYER_SPEEDS_SEC = [2, 2.5, 3] as const;
export type PlayerSpeed = (typeof PLAYER_SPEEDS_SEC)[number];

export type UsePlayerOptions = {
  steps: PlayerStep[];
  divergedIndex: number | null;
  /**
   * When true for the current index, the autoplay timer does not run; the
   * interaction film (or caller) must call `requestAutoAdvance` instead.
   */
  holdsAutoAdvance?: (index: number) => boolean;
};

export type UsePlayerResult = {
  index: number;
  playing: boolean;
  speed: PlayerSpeed;
  atStart: boolean;
  atEnd: boolean;
  seek: (index: number) => void;
  next: () => void;
  prev: () => void;
  /** Start playback; from the last step it restarts at 0 (togglePlay parity). */
  play: () => void;
  togglePlay: () => void;
  pause: () => void;
  setSpeed: (speed: PlayerSpeed) => void;
  /**
   * Advance while staying in play mode (used when a Screen film finishes).
   * No-op when not playing.
   */
  requestAutoAdvance: () => void;
};

export function clampPlayerIndex(index: number, stepCount: number): number {
  const last = Math.max(stepCount - 1, 0);
  return Math.min(Math.max(index, 0), last);
}

/** Pure advance used by the playback timer — exported for unit tests. */
export function advancePlayerPlayback(
  currentIndex: number,
  stepCount: number,
  divergedIndex: number | null,
): { index: number; stop: boolean } {
  const lastIndex = Math.max(stepCount - 1, 0);
  if (currentIndex >= lastIndex) {
    return {
      index: currentIndex,
      stop: true,
    };
  }
  const index = clampPlayerIndex(currentIndex + 1, stepCount);
  if (divergedIndex !== null && index === divergedIndex) {
    return { index, stop: true };
  }
  if (index >= lastIndex) {
    return { index, stop: true };
  }
  return { index, stop: false };
}

/**
 * Pure decision for a film-complete / auto-advance request.
 * Duplicate calls with the same inputs are idempotent (same next index).
 */
export function planAutoAdvance(
  playing: boolean,
  currentIndex: number,
  stepCount: number,
  divergedIndex: number | null,
): { applied: false } | { applied: true; index: number; stop: boolean } {
  if (!playing) return { applied: false };
  const { index, stop } = advancePlayerPlayback(currentIndex, stepCount, divergedIndex);
  return { applied: true, index, stop };
}

/** Whether the dwell timer should arm for this tick. */
export function shouldArmAutoplayTimer(
  playing: boolean,
  stepCount: number,
  held: boolean,
): boolean {
  return playing && stepCount > 0 && !held;
}

export function usePlayer({
  steps,
  divergedIndex,
  holdsAutoAdvance,
}: UsePlayerOptions): UsePlayerResult {
  const stepCount = steps.length;
  const lastIndex = Math.max(stepCount - 1, 0);

  const [index, setIndex] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [speed, setSpeedState] = useState<PlayerSpeed>(PLAYER_SPEEDS_SEC[0]);

  const seek = useCallback(
    (nextIndex: number) => {
      setIndex(clampPlayerIndex(nextIndex, stepCount));
    },
    [stepCount],
  );

  const next = useCallback(() => {
    setPlaying(false);
    setIndex((i) => clampPlayerIndex(i + 1, stepCount));
  }, [stepCount]);

  const prev = useCallback(() => {
    setPlaying(false);
    setIndex((i) => clampPlayerIndex(i - 1, stepCount));
  }, [stepCount]);

  const play = useCallback(() => {
    setIndex((i) => (i >= lastIndex ? 0 : i));
    setPlaying(true);
  }, [lastIndex]);

  const togglePlay = useCallback(() => {
    if (playing) {
      setPlaying(false);
      return;
    }
    setIndex((i) => (i >= lastIndex ? 0 : i));
    setPlaying(true);
  }, [playing, lastIndex]);

  const setSpeed = useCallback((nextSpeed: PlayerSpeed) => {
    setSpeedState(nextSpeed);
  }, []);

  const pause = useCallback(() => setPlaying(false), []);

  const requestAutoAdvance = useCallback(() => {
    const plan = planAutoAdvance(playing, index, stepCount, divergedIndex);
    if (!plan.applied) return;
    setIndex(plan.index);
    if (plan.stop) setPlaying(false);
  }, [playing, index, stepCount, divergedIndex]);

  const held = holdsAutoAdvance?.(index) ?? false;
  const armTimer = shouldArmAutoplayTimer(playing, stepCount, held);

  useEffect(() => {
    if (!armTimer) return;

    const timer = setTimeout(() => {
      const { index: advanced, stop } = advancePlayerPlayback(index, stepCount, divergedIndex);
      setIndex(advanced);
      if (stop) setPlaying(false);
    }, speed * 1000);

    return () => clearTimeout(timer);
  }, [armTimer, index, speed, stepCount, divergedIndex]);

  return {
    index,
    playing,
    speed,
    atStart: index <= 0,
    atEnd: index >= lastIndex,
    seek,
    next,
    prev,
    play,
    togglePlay,
    pause,
    setSpeed,
    requestAutoAdvance,
  };
}
