'use client';

import { useEffect, useRef } from 'react';
import type { PlayerStep } from './steps.ts';
import { TimelineClip } from './TimelineClip.tsx';
import { TimelineProgressBar } from './TimelineProgressBar.tsx';
import { TIMELINE_CLIP_GAP } from './timelineGeometry.ts';

export type TimelineStripProps = {
  steps: PlayerStep[];
  activeIndex: number;
  divergedIndex?: number | null;
  onSeek?: (index: number) => void;
  /** When false, the playhead does not auto-scroll into view (Storybook baselines). */
  autoScroll?: boolean;
  onScrubBegin?: () => void;
};

export function TimelineStrip({
  steps,
  activeIndex,
  divergedIndex = null,
  onSeek,
  autoScroll = true,
  onScrubBegin,
}: TimelineStripProps) {
  const scrollerRef = useRef<HTMLDivElement>(null);
  const activeRef = useRef<HTMLDivElement>(null);

  // biome-ignore lint/correctness/useExhaustiveDependencies: activeIndex drives scroll-into-view when enabled
  useEffect(() => {
    if (!autoScroll) return;
    const el = activeRef.current;
    if (!el) return;
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollIntoView({
      behavior: reducedMotion ? 'auto' : 'smooth',
      block: 'nearest',
      inline: 'center',
    });
  }, [activeIndex, autoScroll]);

  const seekTo = (index: number) => {
    onScrubBegin?.();
    onSeek?.(index);
  };

  return (
    <div className="w-full">
      <div
        ref={scrollerRef}
        className="overflow-x-auto overflow-y-visible pb-2"
        data-timeline-scroller
      >
        <div className="mx-auto w-max px-1.5">
          <TimelineProgressBar
            stepCount={steps.length}
            activeIndex={activeIndex}
            diverged={divergedIndex !== null && activeIndex === divergedIndex}
            onSeek={onSeek}
            onScrubBegin={onScrubBegin}
          />
          <div className="mb-1 flex" style={{ gap: TIMELINE_CLIP_GAP }}>
            {steps.map((step) => (
              <button
                key={`ruler-${step.nodeId}-${step.index}`}
                type="button"
                className="w-[120px] shrink-0 text-center text-[11px] text-fg-subtle hover:text-fg-muted"
                onClick={() => seekTo(step.index)}
              >
                {step.index + 1}
              </button>
            ))}
          </div>
          <div className="flex" style={{ gap: TIMELINE_CLIP_GAP }}>
            {steps.map((step) => {
              const active = step.index === activeIndex;
              const diverged = divergedIndex !== null && step.index === divergedIndex;
              return (
                <div
                  key={`clip-${step.nodeId}-${step.index}`}
                  ref={active ? activeRef : undefined}
                  className="shrink-0"
                >
                  <TimelineClip
                    step={step}
                    active={active}
                    diverged={diverged}
                    onSeek={onSeek ? () => seekTo(step.index) : undefined}
                  />
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
