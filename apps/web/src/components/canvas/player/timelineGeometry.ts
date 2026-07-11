/** Shared clip geometry — keep the progress playhead aligned with clip centers. */
export const TIMELINE_CLIP_WIDTH = 120;
export const TIMELINE_CLIP_GAP = 10;

/** Half of the playhead dot (h-3 w-3) — inset so 0%/100% positions are not clipped. */
export const TIMELINE_PLAYHEAD_INSET = 6;

export function timelineStripWidth(stepCount: number): number {
  if (stepCount <= 0) return 0;
  return stepCount * TIMELINE_CLIP_WIDTH + (stepCount - 1) * TIMELINE_CLIP_GAP;
}

export function timelinePlayheadOffset(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const stripWidth = timelineStripWidth(stepCount);
  if (stepCount === 1) return stripWidth / 2;
  const travel = stripWidth - TIMELINE_PLAYHEAD_INSET * 2;
  if (activeIndex <= 0) return TIMELINE_PLAYHEAD_INSET;
  if (activeIndex >= stepCount - 1) return stripWidth - TIMELINE_PLAYHEAD_INSET;
  return TIMELINE_PLAYHEAD_INSET + (activeIndex / (stepCount - 1)) * travel;
}

export function timelineFillWidth(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  if (stepCount === 1) return timelineStripWidth(stepCount);
  if (activeIndex <= 0) return 0;
  return timelinePlayheadOffset(activeIndex, stepCount);
}
