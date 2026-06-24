// Viewport-aware placement for floating panels anchored to a screen-space rect.
// Used by NodeInspector (§7 surface #2).

export type ScreenRect = { left: number; top: number; right: number; bottom: number };

const DEFAULT_MARGIN = 12;
/** Height budget used for flip logic — matches NodeInspector max-height cap. */
export const PANEL_MAX_HEIGHT = 560;

function clamp(value: number, min: number, max: number): number {
  return Math.min(Math.max(value, min), max);
}

export function placeFloatingPanel(
  anchor: ScreenRect,
  panel: { width: number; height: number },
  opts?: { margin?: number; viewport?: { width: number; height: number } },
): { left: number; top: number } {
  const margin = opts?.margin ?? DEFAULT_MARGIN;
  const vw = opts?.viewport?.width ?? (typeof window !== 'undefined' ? window.innerWidth : 1200);
  const vh = opts?.viewport?.height ?? (typeof window !== 'undefined' ? window.innerHeight : 800);

  const anchorW = anchor.right - anchor.left;
  // ⅛ of the shape's on-screen width ≡ ⅛ of flow width × zoom — constant relative
  // to the node at every zoom level (tight when zoomed out, proportionally wider in).
  const offset = anchorW / 8;
  const heightBudget = Math.min(panel.height, PANEL_MAX_HEIGHT);
  const anchorMidY = (anchor.top + anchor.bottom) / 2;

  // Prefer right of the node, vertically centered on it.
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

  // Middle-align with the shape; clamp to viewport without overlapping vertically
  // if we can help it.
  let top = anchorMidY - heightBudget / 2;
  top = clamp(top, margin, vh - margin - heightBudget);

  return { left, top };
}
