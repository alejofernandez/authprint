// Floating node-type quick-pick (E26 / §7): the structural-type menu shared by
// the per-handle `+` (US-049) and drag-from-handle (US-050). Five creatable
// types — never Entry (one per flow). Keyboard-navigable (↑/↓/Enter/Esc),
// anchored at the cursor/handle, dismissed on outside-click or Esc.

'use client';

import { useEffect, useRef, useState } from 'react';
import { CREATABLE_TYPES, type CreatableType } from './ydoc/create.ts';

const TYPE_META: Record<CreatableType, { label: string; dot: string }> = {
  screen: { label: 'Screen', dot: 'bg-indigo-500' },
  decision: { label: 'Decision', dot: 'bg-violet-500' },
  action: { label: 'Action', dot: 'bg-sky-500' },
  external: { label: 'External', dot: 'bg-teal-500' },
  outcome: { label: 'Outcome', dot: 'bg-emerald-500' },
};

export function NodeTypePicker({
  anchor,
  onPick,
  onClose,
}: {
  /** Screen coordinates to anchor the menu's top-left near. */
  anchor: { x: number; y: number };
  onPick: (type: CreatableType) => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % CREATABLE_TYPES.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + CREATABLE_TYPES.length) % CREATABLE_TYPES.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const type = CREATABLE_TYPES[active];
        if (type) onPick(type);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onPick, onClose]);

  // Keep the menu on screen: a fixed-width card, nudged left/up near edges.
  const left = Math.min(anchor.x, window.innerWidth - 180);
  const top = Math.min(anchor.y, window.innerHeight - 220);

  return (
    <>
      {/* Outside-click catcher. */}
      <button
        type="button"
        aria-label="Close menu"
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="listbox"
        aria-label="Node type"
        className="fixed z-50 w-40 overflow-hidden rounded-lg border border-zinc-200 bg-white p-1 shadow-xl outline-none dark:border-zinc-700 dark:bg-zinc-900"
        style={{ left, top }}
      >
        <div className="px-2 py-1 text-[10px] font-medium text-zinc-400 uppercase tracking-wider">
          Add node
        </div>
        {CREATABLE_TYPES.map((type, i) => (
          <button
            key={type}
            type="button"
            role="option"
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(type)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              i === active
                ? 'bg-indigo-50 text-indigo-900 dark:bg-indigo-950/60 dark:text-indigo-100'
                : 'text-zinc-700 dark:text-zinc-300'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${TYPE_META[type].dot}`} />
            {TYPE_META[type].label}
          </button>
        ))}
      </div>
    </>
  );
}
