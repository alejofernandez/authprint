'use client';

import { useEffect, useRef, useState } from 'react';
import { type FilmClockState, type FilmOp, filmClockAt } from './interactionFilm.ts';

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

/**
 * Pause-aware film clock: elapsed time only advances while `playing` is true.
 * Remount (via key on ScreenPlayFilm) resets. Completion fires once per mount.
 */
export function useInteractionFilmClock(
  ops: readonly FilmOp[] | null,
  playing: boolean,
  onComplete: (() => void) | undefined,
): FilmClockState | null {
  const totalMs = ops?.reduce((s, o) => s + o.durationMs, 0) ?? 0;
  const reduced = prefersReducedMotion();
  const [elapsedMs, setElapsedMs] = useState(0);
  const elapsedRef = useRef(0);
  const completedRef = useRef(false);
  const onCompleteRef = useRef(onComplete);

  useEffect(() => {
    onCompleteRef.current = onComplete;
  }, [onComplete]);

  useEffect(() => {
    if (!ops || ops.length === 0 || reduced) return;
    if (!playing) return;

    let frame = 0;
    let last = performance.now();

    const tick = (now: number) => {
      const delta = now - last;
      last = now;
      const next = Math.min(totalMs, elapsedRef.current + delta);
      elapsedRef.current = next;
      setElapsedMs(next);
      if (next >= totalMs) {
        if (!completedRef.current) {
          completedRef.current = true;
          onCompleteRef.current?.();
        }
        return;
      }
      frame = requestAnimationFrame(tick);
    };

    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [ops, playing, totalMs, reduced]);

  if (!ops || ops.length === 0) return null;
  // Reduced motion: jump to the end state; dwell timer (not this clock) advances.
  if (reduced) return filmClockAt(ops, totalMs);
  return filmClockAt(ops, elapsedMs);
}
