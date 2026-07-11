/** Shared clip geometry — keep the progress playhead aligned with clip centers. */
export const TIMELINE_CLIP_WIDTH = 120;
export const TIMELINE_CLIP_GAP = 10;

export function timelineStripWidth(stepCount: number): number {
  if (stepCount <= 0) return 0;
  return stepCount * TIMELINE_CLIP_WIDTH + (stepCount - 1) * TIMELINE_CLIP_GAP;
}

export function timelinePlayheadOffset(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const stripWidth = timelineStripWidth(stepCount);
  if (stepCount === 1) return stripWidth;
  if (activeIndex <= 0) return 0;
  if (activeIndex >= stepCount - 1) return stripWidth;
  return (activeIndex / (stepCount - 1)) * stripWidth;
}

export function timelineFillWidth(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  return timelinePlayheadOffset(activeIndex, stepCount);
}
