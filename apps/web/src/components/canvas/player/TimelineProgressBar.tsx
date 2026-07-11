'use client';

import { useCallback, useRef, useState } from 'react';
import {
  clampTimelineScrubX,
  TIMELINE_CLIP_GAP,
  TIMELINE_CLIP_WIDTH,
  TIMELINE_PLAYHEAD_INSET,
  timelineFillWidth,
  timelinePlayheadOffset,
  timelineStepIndexFromOffset,
  timelineStripWidth,
} from './timelineGeometry.ts';

export type TimelineProgressBarProps = {
  stepCount: number;
  activeIndex: number;
  diverged?: boolean;
  onSeek?: (index: number) => void;
  /** Called when the user begins scrubbing — e.g. pause autoplay. */
  onScrubBegin?: () => void;
};

/** Scrub track — draggable playhead snaps to the nearest step on release. */
export function TimelineProgressBar({
  stepCount,
  activeIndex,
  diverged = false,
  onSeek,
  onScrubBegin,
}: TimelineProgressBarProps) {
  const trackRef = useRef<HTMLDivElement>(null);
  const [dragging, setDragging] = useState(false);
  const [dragX, setDragX] = useState<number | null>(null);

  const stripWidth = timelineStripWidth(stepCount);
  const scrubbing = dragging && dragX !== null;
  const playheadX = scrubbing ? dragX : timelinePlayheadOffset(activeIndex, stepCount);
  const fillWidth = scrubbing ? dragX : timelineFillWidth(activeIndex, stepCount);
  const interactive = onSeek !== undefined;

  const xFromClient = useCallback(
    (clientX: number) => {
      const el = trackRef.current;
      if (!el) return TIMELINE_PLAYHEAD_INSET;
      const rect = el.getBoundingClientRect();
      return clampTimelineScrubX(clientX - rect.left, stepCount);
    },
    [stepCount],
  );

  const commitSeek = useCallback(
    (clientX: number) => {
      if (!onSeek) return;
      const x = xFromClient(clientX);
      onSeek(timelineStepIndexFromOffset(x, stepCount));
    },
    [onSeek, stepCount, xFromClient],
  );

  const beginScrub = useCallback(() => {
    onScrubBegin?.();
  }, [onScrubBegin]);

  const onPlayheadPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!interactive) return;
    event.preventDefault();
    beginScrub();
    event.currentTarget.setPointerCapture(event.pointerId);
    setDragging(true);
    setDragX(xFromClient(event.clientX));
  };

  const onPlayheadPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    setDragX(xFromClient(event.clientX));
  };

  const finishDrag = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!dragging) return;
    commitSeek(event.clientX);
    setDragging(false);
    setDragX(null);
  };

  const onTrackPointerDown = (event: React.PointerEvent<HTMLDivElement>) => {
    if (!interactive || event.button !== 0) return;
    if (event.target !== event.currentTarget) return;
    beginScrub();
    commitSeek(event.clientX);
  };

  if (stepCount === 0) return null;

  const playheadClassName = `absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-bg-panel shadow-sm ${
    scrubbing ? '' : 'transition-[left] duration-[var(--duration-fast)] ease-standard'
  } ${
    diverged
      ? 'border-signal-danger-ring dark:border-signal-danger'
      : 'border-accent-primary-border dark:border-accent-primary'
  }`;

  return (
    <div
      ref={trackRef}
      className="relative mb-3 shrink-0 py-1.5"
      style={{ width: stripWidth }}
      data-timeline-progress
    >
      <div
        data-timeline-track
        className={`relative h-1.5 overflow-hidden rounded-full bg-border-subtle dark:bg-border-default ${
          interactive ? 'cursor-pointer' : ''
        }`}
        onPointerDown={onTrackPointerDown}
      >
        <div
          className={`absolute inset-y-0 left-0 rounded-full ${
            scrubbing ? '' : 'transition-[width] duration-[var(--duration-fast)] ease-standard'
          } ${diverged ? 'bg-signal-danger' : 'bg-accent-primary-solid dark:bg-accent-primary'}`}
          style={{ width: fillWidth }}
        />
      </div>
      {interactive ? (
        <button
          type="button"
          role="slider"
          aria-label="Timeline playhead"
          aria-valuemin={1}
          aria-valuemax={stepCount}
          aria-valuenow={activeIndex + 1}
          onPointerDown={onPlayheadPointerDown}
          onPointerMove={onPlayheadPointerMove}
          onPointerUp={finishDrag}
          onPointerCancel={finishDrag}
          className={`${playheadClassName} touch-none cursor-grab active:cursor-grabbing`}
          style={{ left: playheadX }}
        />
      ) : (
        <div aria-hidden className={playheadClassName} style={{ left: playheadX }} />
      )}
    </div>
  );
}

export { TIMELINE_CLIP_GAP, TIMELINE_CLIP_WIDTH };
