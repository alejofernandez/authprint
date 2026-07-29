'use client';

// Scenario-aware Play control for the toolbar (US-132 / US-129).
// Mirrors the transport's scenario picker markup; does not touch PlayerMode.

import type { Scenario } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useEffect, useState } from 'react';

const btnBase =
  'inline-flex min-h-6 min-w-6 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm font-medium transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border';

export function PlayButton({
  scenarios,
  onPlay,
  onRecord,
}: {
  scenarios: readonly Scenario[];
  onPlay: (scenario: Scenario) => void;
  onRecord: () => void;
}) {
  const t = useTranslations('topbar');
  const tPlayer = useTranslations('player');
  const [lastPlayedId, setLastPlayedId] = useState<string | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  // Escape closes it, like every other dismissable surface on this canvas.
  useEffect(() => {
    if (!pickerOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPickerOpen(false);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [pickerOpen]);

  if (scenarios.length === 0) {
    return (
      <button
        type="button"
        onClick={onRecord}
        aria-label={tPlayer('canvasPlayEmpty')}
        title={tPlayer('canvasPlayEmpty')}
        className={`${btnBase} bg-accent-primary text-white hover:opacity-90`}
      >
        <span aria-hidden="true">▶</span>
        <span className="max-w-[9rem] truncate">{t('recordScenario')}</span>
      </button>
    );
  }

  const preferred = scenarios.find((s) => s.id === lastPlayedId) ?? scenarios[0];
  if (!preferred) return null;

  const play = (scenario: Scenario) => {
    setLastPlayedId(scenario.id);
    setPickerOpen(false);
    onPlay(scenario);
  };

  const playLabel = t('playScenario', { name: preferred.name });
  const playAria = tPlayer('canvasPlay', { name: preferred.name });

  if (scenarios.length === 1) {
    return (
      <button
        type="button"
        onClick={() => play(preferred)}
        aria-label={playAria}
        title={playAria}
        className={`${btnBase} bg-accent-primary text-white hover:opacity-90`}
      >
        <span aria-hidden="true">▶</span>
        <span className="max-w-[9rem] truncate">{playLabel}</span>
      </button>
    );
  }

  return (
    // No `min-w-0` here: it would let this shrink below the glyph + chevron the
    // two buttons need, and flex children that overflow their own parent get
    // drawn under the next sibling (the ⌘K pill landed on top of them at
    // narrow widths). The label span inside absorbs the squeeze instead.
    <div className="relative flex items-stretch">
      <button
        type="button"
        onClick={() => play(preferred)}
        aria-label={playAria}
        title={playAria}
        className={`${btnBase} min-w-0 shrink rounded-r-none bg-accent-primary text-white hover:opacity-90`}
      >
        <span aria-hidden="true">▶</span>
        {/* `min-w-0` makes the label the part that gives way: without it the
            span's min-content keeps the whole control from shrinking, and the
            group spills sideways into the flow name. Below the narrow
            breakpoint it goes entirely, so the bar drops *labels* before it
            drops *state* — the Problems readout stays visible instead of being
            clipped off the end. `aria-label` carries the name throughout. */}
        <span className="hidden min-w-0 max-w-[7rem] truncate min-[520px]:block sm:max-w-[9rem]">
          {playLabel}
        </span>
      </button>
      <button
        type="button"
        aria-haspopup="menu"
        aria-expanded={pickerOpen}
        aria-label={tPlayer('scenarioPicker.open')}
        onClick={() => setPickerOpen((open) => !open)}
        className={`${btnBase} rounded-l-none border-l border-white/25 bg-accent-primary px-1.5 text-white hover:opacity-90`}
      >
        <ChevronDownIcon />
      </button>

      {pickerOpen ? (
        <>
          {/* Click-outside catcher: pointer-only, and deliberately NOT in the
              tab order. As a focusable button it was a full-viewport stop whose
              accessible name claimed it opened the picker while it closed it.
              Escape is the keyboard path (above). */}
          <div
            aria-hidden="true"
            className="fixed inset-0 z-40 cursor-default"
            onClick={() => setPickerOpen(false)}
          />
          <div
            role="menu"
            className="absolute top-full right-0 z-50 mt-1 max-h-48 min-w-[16rem] max-w-96 overflow-auto rounded-lg border border-border-subtle bg-bg-panel py-1 text-left shadow-lg dark:border-border-default dark:bg-bg-panel"
            aria-label={tPlayer('scenarioPicker.open')}
          >
            {scenarios.map((scenario) => {
              const active = scenario.id === preferred.id;
              return (
                <button
                  key={scenario.id}
                  type="button"
                  role="menuitem"
                  className={`block min-h-6 w-full truncate px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                    active ? 'font-semibold text-accent-primary-fg-emphasis' : 'text-fg-default'
                  }`}
                  title={scenario.name}
                  aria-current={active ? 'true' : undefined}
                  onClick={() => play(scenario)}
                >
                  {active ? (
                    <span className="sr-only">{tPlayer('scenarioPicker.current')}: </span>
                  ) : null}
                  {scenario.name}
                </button>
              );
            })}
          </div>
        </>
      ) : null}
    </div>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 opacity-90"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}
