// Viewport-aware placement for floating panels anchored to a screen-space rect.
// Shared by NodeInspector and NodeTypePicker (§7 surface #2 + create quick-pick).

import type { Node as RfNode } from '@xyflow/react';
import { NODE_SIZE } from './flowToReactFlow.ts';

export type ScreenRect = { left: number; top: number; right: number; bottom: number };

const DEFAULT_MARGIN = 12;
/** Height budget used for flip logic — matches NodeInspector max-height cap. */
export const PANEL_MAX_HEIGHT = 560;
/** Extra gap so node-type picker clears the per-handle `+` (12px offset + 20px button). */
export const PLUS_AFFORDANCE_GAP = 32;

type PlacementOpts = {
  margin?: number;
  viewport?: { width: number; height: number };
  /** Additional gap past the anchor edge — used by NodeTypePicker to keep `+` visible. */
  affordanceGap?: number;
};

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

/** Node bounds in screen space (zoom-aware — both corners transformed). */
export function nodeScreenRect(
  node: RfNode | undefined,
  flowToScreenPosition: (p: { x: number; y: number }) => { x: number; y: number },
): ScreenRect | null {
  if (!node) return null;
  const intrinsic = node.type ? NODE_SIZE[node.type as keyof typeof NODE_SIZE] : null;
  const w = node.measured?.width ?? node.width ?? intrinsic?.width ?? 180;
  const h = node.measured?.height ?? node.height ?? intrinsic?.height ?? 64;
  const topLeft = flowToScreenPosition({ x: node.position.x, y: node.position.y });
  const bottomRight = flowToScreenPosition({
    x: node.position.x + w,
    y: node.position.y + h,
  });
  return {
    left: topLeft.x,
    top: topLeft.y,
    right: bottomRight.x,
    bottom: bottomRight.y,
  };
}

export function placeFloatingPanel(
  anchor: ScreenRect,
  panel: { width: number; height: number },
  opts?: PlacementOpts,
): { left: number; top: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const vw = opts?.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts?.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);

  const anchorW = anchor.right - anchor.left;
  const offset = anchorW / 8 + (opts?.affordanceGap ?? 0);
  const heightBudget = Math.min(panel.height, PANEL_MAX_HEIGHT);
  const anchorMidY = (anchor.top + anchor.bottom) / 2;

  const rightLeft = anchor.right + offset;
  const leftLeft = anchor.left - panel.width - offset;
  const fitsRight = rightLeft + panel.width <= vw - margin;
  const fitsLeft = leftLeft >= margin;

  let left: number;
  if (fitsRight) {
    left = rightLeft;
  } else if (fitsLeft) {
    left = leftLeft;
  } else {
    const roomRight = vw - margin - rightLeft;
    const roomLeft = anchor.left - offset - margin;
    left =
      roomRight >= roomLeft
        ? Math.min(rightLeft, vw - margin - panel.width)
        : Math.max(margin, leftLeft);
  }

  let top = anchorMidY - heightBudget / 2;
  top = clamp(top, margin, vh - margin - heightBudget);

  return { left, top };
}

/** Below the anchor, horizontally centered; flips above when clipped. */
export function placeFloatingPanelBelow(
  anchor: ScreenRect,
  panel: { width: number; height: number },
  opts?: PlacementOpts,
): { left: number; top: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const vw = opts?.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts?.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);

  const anchorH = anchor.bottom - anchor.top;
  const offset = anchorH / 8 + (opts?.affordanceGap ?? 0);
  const anchorMidX = (anchor.left + anchor.right) / 2;

  let top = anchor.bottom + offset;
  if (top + panel.height > vh - margin) {
    top = anchor.top - panel.height - offset;
  }
  top = clamp(top, margin, vh - margin - panel.height);

  let left = anchorMidX - panel.width / 2;
  left = clamp(left, margin, vw - margin - panel.width);

  return { left, top };
}

/** Cursor / drop placement — nudge inside the viewport. */
export function placeFloatingPanelAtPoint(
  at: { x: number; y: number },
  panel: { width: number; height: number },
  opts?: { margin?: number; viewport?: { width: number; height: number } },
): { left: number; top: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const vw = opts?.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts?.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);

  return {
    left: clamp(at.x, margin, vw - margin - panel.width),
    top: clamp(at.y, margin, vh - margin - panel.height),
  };
}
