'use client';

import { useLayoutEffect, useRef, useState } from 'react';
import {
  clearFilmCursorMemory,
  filmCursorFromNorm,
  filmCursorToNorm,
  readFilmCursorMemory,
  writeFilmCursorMemory,
} from './filmCursorMemory.ts';

type CursorPos = { x: number; y: number };

function easeInOutCubic(t: number): number {
  return t < 0.5 ? 4 * t * t * t : 1 - (-2 * t + 2) ** 3 / 2;
}

function measureTarget(root: HTMLElement, targetId: string): CursorPos | null {
  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(targetId)
      : targetId.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const el = root.querySelector(`[data-film-target="${escaped}"]`);
  if (!(el instanceof HTMLElement)) return null;
  const rootBox = root.getBoundingClientRect();
  const box = el.getBoundingClientRect();
  // StagePresentationFrame scales an ancestor; rects are in screen pixels but
  // absolute left/top are in the container's local (unscaled) CSS pixels.
  const scaleX = root.offsetWidth > 0 ? rootBox.width / root.offsetWidth : 1;
  const scaleY = root.offsetHeight > 0 ? rootBox.height / root.offsetHeight : 1;
  return {
    x: (box.left - rootBox.left + box.width / 2) / scaleX,
    y: (box.top - rootBox.top + box.height / 2) / scaleY,
  };
}

function containerCenter(root: HTMLElement): CursorPos {
  return { x: root.offsetWidth / 2, y: root.offsetHeight / 2 };
}

function initialFromPos(root: HTMLElement, carryFromPrior: boolean): CursorPos {
  if (carryFromPrior) {
    const prior = readFilmCursorMemory();
    if (prior) return filmCursorFromNorm(root, prior);
  }
  return containerCenter(root);
}

function lerpPos(from: CursorPos, to: CursorPos, t: number): CursorPos {
  return {
    x: from.x + (to.x - from.x) * t,
    y: from.y + (to.y - from.y) * t,
  };
}

/** Painted size; paths use viewBox 0 0 512 512 from the authored cursor.svg. */
const CURSOR_SIZE = 24;
/** Tip of the NE-pointing arrowhead in the 512 viewBox. */
const TIP_X = 200;
const TIP_Y = 52;
const HOTSPOT_X = (TIP_X / 512) * CURSOR_SIZE;
const HOTSPOT_Y = (TIP_Y / 512) * CURSOR_SIZE;

/** Outer silhouette of the authored cursor (Downloads/cursor.svg). */
const CURSOR_OUTER =
  'M 198.59 461.50 C172.41,470.29 140.59,455.47 130.90,429.98 C127.11,420.00 127.16,420.58 123.50,344.00 C122.08,314.20 121.41,300.44 119.02,252.00 C118.46,240.73 117.34,217.77 116.53,201.00 C115.72,184.23 114.32,155.78 113.43,137.79 C111.94,108.06 111.94,104.38 113.36,97.43 C121.32,58.37 163.85,37.03 199.70,54.10 C206.09,57.14 218.90,67.32 276.98,115.50 C295.67,131.00 306.11,139.62 326.00,155.98 C336.22,164.39 349.29,175.19 397.45,215.00 C414.41,229.02 432.05,243.55 436.63,247.27 C452.45,260.12 458.87,268.97 462.52,283.00 C464.75,291.54 464.08,306.03 461.07,314.50 C456.67,326.90 446.02,339.18 434.80,344.81 C422.73,350.86 421.26,351.00 369.54,351.03 C333.36,351.06 320.65,351.40 314.50,352.49 C304.02,354.36 291.85,360.40 284.10,367.56 C280.85,370.58 267.93,386.64 255.40,403.27 C242.86,419.90 230.27,436.42 227.41,440.00 C217.44,452.48 210.87,457.38 198.59,461.50 Z';

/** Inner edge of the black outline ring. */
const CURSOR_INNER =
  'M 174.76 430.58 C180.73,432.71 186.05,432.30 192.05,429.25 C197.13,426.67 199.18,424.22 225.73,389.04 C241.28,368.44 255.91,349.62 258.25,347.22 C268.71,336.49 286.76,326.13 302.50,321.82 C310.12,319.73 313.02,319.60 363.00,319.06 C414.69,318.51 415.56,318.47 419.62,316.29 C430.69,310.37 435.05,296.49 429.33,285.37 C427.41,281.64 420.51,275.66 371.91,235.68 C357.45,223.77 261.64,144.63 216.22,107.07 C201.21,94.65 187.04,83.63 184.72,82.56 C178.86,79.87 168.05,79.91 162.00,82.65 C153.18,86.64 146.52,94.66 144.97,103.19 C144.56,105.38 145.52,133.58 147.09,165.84 C148.66,198.10 151.09,247.90 152.48,276.50 C153.88,305.10 155.91,346.95 157.00,369.50 C158.08,392.05 159.24,412.17 159.57,414.21 C160.24,418.41 164.71,425.11 168.49,427.58 C169.88,428.50 172.70,429.84 174.76,430.58 Z';

/**
 * Floating pointer for the play-mode interaction film. Positions the tip over
 * `[data-film-target="…"]` inside `containerRef`, lerping during moves so travel
 * matches the film clock (and pauses with it).
 */
export function InteractionCursor({
  containerRef,
  targetId,
  clicking,
  moveProgress,
  carryFromPrior,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  targetId: string | null;
  clicking: boolean;
  /** 0..1 during a move op; null when sitting on a target. */
  moveProgress: number | null;
  /** When true, open from the prior screen film's last tip (normalized). */
  carryFromPrior: boolean;
}) {
  const [toPos, setToPos] = useState<CursorPos | null>(null);
  const fromPosRef = useRef<CursorPos | null>(null);
  const settledPosRef = useRef<CursorPos | null>(null);
  const lastTargetRef = useRef<string | null>(null);
  const [rippleKey, setRippleKey] = useState(0);
  const wasClickingRef = useRef(false);
  const seededRef = useRef(false);

  useLayoutEffect(() => {
    if (seededRef.current) return;
    seededRef.current = true;
    if (!carryFromPrior) clearFilmCursorMemory();
  }, [carryFromPrior]);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !targetId) {
      setToPos(null);
      return;
    }
    const next = measureTarget(root, targetId);
    if (!next) {
      setToPos(null);
      return;
    }
    if (lastTargetRef.current !== targetId) {
      fromPosRef.current = settledPosRef.current ?? initialFromPos(root, carryFromPrior);
      lastTargetRef.current = targetId;
    }
    setToPos(next);
  }, [containerRef, targetId, carryFromPrior]);

  useLayoutEffect(() => {
    if (clicking && !wasClickingRef.current) {
      setRippleKey((k) => k + 1);
    }
    wasClickingRef.current = clicking;
  }, [clicking]);

  useLayoutEffect(() => {
    if (!toPos) return;
    if (moveProgress === null || moveProgress >= 1) {
      settledPosRef.current = toPos;
    }
  }, [toPos, moveProgress]);

  const pos = (() => {
    if (!toPos || !targetId) return null;
    const from = fromPosRef.current ?? toPos;
    const t = moveProgress === null ? 1 : easeInOutCubic(Math.min(1, Math.max(0, moveProgress)));
    return lerpPos(from, toPos, t);
  })();

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !pos) return;
    writeFilmCursorMemory(filmCursorToNorm(root, pos));
  }, [containerRef, pos]);

  if (!pos) return null;

  return (
    <div
      className="pointer-events-none absolute z-20"
      style={{
        left: pos.x - HOTSPOT_X,
        top: pos.y - HOTSPOT_Y,
      }}
      data-interaction-cursor
      aria-hidden
    >
      {clicking ? (
        <span
          key={rippleKey}
          className="film-tap-ripple absolute h-4 w-4 rounded-full border-2 border-accent-primary-solid bg-accent-primary-solid/30"
          style={{ left: HOTSPOT_X, top: HOTSPOT_Y }}
          data-film-tap-ripple
        />
      ) : null}
      <CursorIcon pressing={clicking} />
    </div>
  );
}

/** Authored cursor.svg with white body fill + black outline ring. */
function CursorIcon({ pressing }: { pressing: boolean }) {
  return (
    <svg
      width={CURSOR_SIZE}
      height={CURSOR_SIZE}
      viewBox="0 0 512 512"
      fill="none"
      className={`drop-shadow-md motion-reduce:transition-none transition-transform duration-[var(--duration-fast)] ${
        pressing ? 'scale-90' : 'scale-100'
      }`}
      style={{ transformOrigin: `${HOTSPOT_X}px ${HOTSPOT_Y}px` }}
      role="presentation"
      aria-hidden
      focusable="false"
    >
      <path d={CURSOR_OUTER} fill="white" />
      <path d={`${CURSOR_OUTER} ${CURSOR_INNER}`} fill="#0a0a0a" fillRule="evenodd" />
    </svg>
  );
}
