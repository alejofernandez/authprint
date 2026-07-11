/** Shared clip geometry — keep the progress playhead aligned with clip centers. */
export const TIMELINE_CLIP_WIDTH = 120;
export const TIMELINE_CLIP_GAP = 10;

/** Half of the playhead dot (h-3 w-3) — inset so edge positions are not clipped. */
export const TIMELINE_PLAYHEAD_INSET = 6;

export function timelineStripWidth(stepCount: number): number {
  if (stepCount <= 0) return 0;
  return stepCount * TIMELINE_CLIP_WIDTH + (stepCount - 1) * TIMELINE_CLIP_GAP;
}

export function timelineClipLeft(index: number): number {
  return index * (TIMELINE_CLIP_WIDTH + TIMELINE_CLIP_GAP);
}

/** Horizontal center of a clip — aligns with the step number above it. */
export function timelineClipCenter(index: number): number {
  return timelineClipLeft(index) + TIMELINE_CLIP_WIDTH / 2;
}

/**
 * Playhead X: first step at the clip's left edge, last at the right edge,
 * all others at the clip center (under the step number).
 */
export function timelinePlayheadOffset(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const stripWidth = timelineStripWidth(stepCount);
  if (stepCount === 1) return TIMELINE_PLAYHEAD_INSET;
  if (activeIndex <= 0) return TIMELINE_PLAYHEAD_INSET;
  if (activeIndex >= stepCount - 1) return stripWidth - TIMELINE_PLAYHEAD_INSET;
  return timelineClipCenter(activeIndex);
}

export function timelineFillWidth(activeIndex: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  if (stepCount === 1) return timelineStripWidth(stepCount);
  if (activeIndex <= 0) return 0;
  return timelinePlayheadOffset(activeIndex, stepCount);
}

/** Map a horizontal scrub position to the nearest step index. */
export function timelineStepIndexFromOffset(x: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  let nearest = 0;
  let minDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < stepCount; index++) {
    const offset = timelinePlayheadOffset(index, stepCount);
    const distance = Math.abs(x - offset);
    if (distance < minDistance) {
      minDistance = distance;
      nearest = index;
    }
  }
  return nearest;
}

export function clampTimelineScrubX(x: number, stepCount: number): number {
  if (stepCount <= 0) return 0;
  const stripWidth = timelineStripWidth(stepCount);
  const min = TIMELINE_PLAYHEAD_INSET;
  const max = stepCount === 1 ? stripWidth : stripWidth - TIMELINE_PLAYHEAD_INSET;
  return Math.min(Math.max(x, min), max);
}
