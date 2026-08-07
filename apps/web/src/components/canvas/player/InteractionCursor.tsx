'use client';

import { useLayoutEffect, useState } from 'react';

type CursorPos = { x: number; y: number };

/**
 * Floating pointer for the play-mode interaction film. Positions itself over
 * `[data-film-target="…"]` inside `containerRef`.
 */
export function InteractionCursor({
  containerRef,
  targetId,
  clicking,
}: {
  containerRef: React.RefObject<HTMLElement | null>;
  targetId: string | null;
  clicking: boolean;
}) {
  const [pos, setPos] = useState<CursorPos | null>(null);

  useLayoutEffect(() => {
    const root = containerRef.current;
    if (!root || !targetId) {
      setPos(null);
      return;
    }
    const el = root.querySelector(
      `[data-film-target="${targetId.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"]`,
    );
    if (!(el instanceof HTMLElement)) {
      setPos(null);
      return;
    }
    const rootBox = root.getBoundingClientRect();
    const box = el.getBoundingClientRect();
    setPos({
      x: box.left - rootBox.left + box.width * 0.7,
      y: box.top - rootBox.top + box.height * 0.65,
    });
  }, [containerRef, targetId]);

  if (!pos || !targetId) return null;

  return (
    <div
      className={`pointer-events-none absolute z-20 -translate-x-1 -translate-y-1 motion-reduce:transition-none transition-[left,top,transform] duration-[var(--duration-base)] ease-standard ${
        clicking ? 'scale-90' : 'scale-100'
      }`}
      style={{ left: pos.x, top: pos.y }}
      data-interaction-cursor
      aria-hidden
    >
      <span className="block text-[18px] leading-none drop-shadow-md select-none" aria-hidden>
        ↖
      </span>
    </div>
  );
}
