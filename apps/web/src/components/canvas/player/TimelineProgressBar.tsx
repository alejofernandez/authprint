'use client';

import {
  TIMELINE_CLIP_GAP,
  TIMELINE_CLIP_WIDTH,
  timelineFillWidth,
  timelinePlayheadOffset,
  timelineStripWidth,
} from './timelineGeometry.ts';

export type TimelineProgressBarProps = {
  stepCount: number;
  activeIndex: number;
  diverged?: boolean;
};

/** Display-only scrub track — playhead dot aligns with the active clip center. */
export function TimelineProgressBar({
  stepCount,
  activeIndex,
  diverged = false,
}: TimelineProgressBarProps) {
  if (stepCount === 0) return null;

  const stripWidth = timelineStripWidth(stepCount);
  const playheadX = timelinePlayheadOffset(activeIndex, stepCount);
  const fillWidth = timelineFillWidth(activeIndex, stepCount);

  return (
    <div
      className="relative mb-3 shrink-0 px-1 py-1.5"
      style={{ width: stripWidth }}
      aria-hidden
      data-timeline-progress
    >
      <div className="relative h-1.5 overflow-hidden rounded-full bg-border-subtle dark:bg-border-default">
        <div
          className={`absolute inset-y-0 left-0 rounded-full transition-[width] duration-[var(--duration-fast)] ease-standard ${
            diverged ? 'bg-signal-danger' : 'bg-accent-primary-solid dark:bg-accent-primary'
          }`}
          style={{ width: fillWidth }}
        />
      </div>
      <div
        className={`absolute top-1/2 h-3 w-3 -translate-x-1/2 -translate-y-1/2 rounded-full border-2 bg-bg-panel shadow-sm transition-[left] duration-[var(--duration-fast)] ease-standard ${
          diverged
            ? 'border-signal-danger-ring dark:border-signal-danger'
            : 'border-accent-primary-border dark:border-accent-primary'
        }`}
        style={{ left: playheadX }}
      />
    </div>
  );
}

export { TIMELINE_CLIP_GAP, TIMELINE_CLIP_WIDTH };
