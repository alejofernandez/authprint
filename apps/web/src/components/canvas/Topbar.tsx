'use client';

import { useTranslations } from 'next-intl';

/** Fixed docked topbar height — canvas + ContextPanel offset must match. */
export const TOPBAR_HEIGHT_PX = 48;

export function Topbar({
  flowName,
  onGoHome,
  onOpenPalette,
  onFlowNameClick,
}: {
  flowName: string;
  onGoHome: () => void;
  onOpenPalette: () => void;
  /** Opens document preferences (US-092). */
  onFlowNameClick?: () => void;
}) {
  const tPalette = useTranslations('palette');

  return (
    <header className="flex h-12 shrink-0 items-center gap-3 border-border-subtle border-b bg-bg-panel px-4">
      <button
        type="button"
        onClick={onGoHome}
        className="font-semibold text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:text-accent-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        Authprint
      </button>
      <button
        type="button"
        id="topbar-flow-name"
        onClick={onFlowNameClick}
        className="max-w-xs truncate text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        {flowName}
      </button>
      <button
        type="button"
        onClick={onOpenPalette}
        aria-label={tPalette('openPalette')}
        className="flex items-center gap-2 rounded-md border border-border-default py-1 pr-2 pl-2.5 text-fg-muted text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        {tPalette('searchButton')}
        <kbd className="rounded border border-border-default bg-bg-subtle px-1.5 py-0.5 font-mono text-[11px] text-fg-subtle">
          ⌘K
        </kbd>
      </button>
    </header>
  );
}
