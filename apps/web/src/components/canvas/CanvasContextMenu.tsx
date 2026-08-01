// Canvas context menu (US-133): right-click / tap-hold on empty pane.
// Places an unconnected node where you pointed, and surfaces Play / Search /
// Fit view for users who don't know ⌘K. Reuses NodeTypePicker for the type
// list (via onAddNode) rather than forking a second picker.

'use client';

import type { Scenario } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { placeFloatingPanelAtPoint } from './floatingPanelPlacement.ts';

const PANEL_WIDTH = 220;

export function CanvasContextMenu({
  at,
  scenarios,
  onAddNode,
  onPlay,
  onRecord,
  onOpenPalette,
  onFitView,
  onClose,
}: {
  at: { x: number; y: number };
  scenarios: readonly Scenario[];
  onAddNode: () => void;
  onPlay: (scenario: Scenario) => void;
  onRecord: () => void;
  onOpenPalette: () => void;
  onFitView: () => void;
  onClose: () => void;
}) {
  const t = useTranslations('canvasContextMenu');
  const tPalette = useTranslations('palette');
  const ref = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(180);
  const [active, setActive] = useState(0);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height;
      if (h) setPanelHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const position = useMemo(
    () => placeFloatingPanelAtPoint(at, { width: PANEL_WIDTH, height: panelHeight }),
    [at, panelHeight],
  );

  const playTarget = scenarios[0];
  const items = useMemo(() => {
    const list: {
      id: string;
      label: string;
      hint?: string;
      run: () => void;
    }[] = [
      { id: 'add-node', label: t('addNode'), run: onAddNode },
      playTarget
        ? {
            id: 'play',
            label: t('playScenario', { name: playTarget.name }),
            run: () => onPlay(playTarget),
          }
        : { id: 'record', label: t('recordScenario'), run: onRecord },
      {
        id: 'search',
        label: tPalette('searchButton'),
        hint: '⌘K',
        run: onOpenPalette,
      },
      { id: 'fit', label: tPalette('commands.fitView'), run: onFitView },
    ];
    return list;
  }, [t, tPalette, playTarget, onAddNode, onPlay, onRecord, onOpenPalette, onFitView]);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % items.length);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + items.length) % items.length);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const item = items[active];
        if (item) item.run();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, items, onClose]);

  return (
    <>
      {/* Pointer-only dismiss layer: hidden from the a11y tree and out of the tab
          order, so it can't become a focus stop that announces "Close menu" while
          Escape is the real keyboard path (the trap US-131 catalogued). */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        aria-label={t('close')}
        className="fixed inset-0 z-[55] cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="menu"
        aria-label={t('label')}
        aria-activedescendant={items[active]?.id}
        className="fixed z-[60] overflow-hidden rounded-lg border border-border-subtle bg-bg-panel p-1 shadow-xl outline-none dark:border-border-default"
        style={{ left: position.left, top: position.top, width: PANEL_WIDTH }}
      >
        {items.map((item, i) => (
          <button
            key={item.id}
            id={item.id}
            type="button"
            role="menuitem"
            // Roving focus stays on the menu itself: Tab must not land on an item,
            // or Enter would fire the focused button *and* the active row.
            tabIndex={-1}
            onMouseEnter={() => setActive(i)}
            onClick={item.run}
            className={`flex w-full items-center justify-between gap-3 rounded-md px-2 py-1.5 text-left text-sm ${
              i === active
                ? 'bg-accent-primary-selected-bg text-accent-primary-selected-fg'
                : 'text-fg-secondary dark:text-fg-muted'
            }`}
          >
            <span className="truncate">{item.label}</span>
            {item.hint ? (
              <span className="shrink-0 text-[10px] font-medium text-fg-subtle">{item.hint}</span>
            ) : null}
          </button>
        ))}
      </div>
    </>
  );
}
