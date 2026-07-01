'use client';

import { useTranslations } from 'next-intl';

/** Fixed docked topbar height — canvas + ContextPanel offset must match. */
export const TOPBAR_HEIGHT_PX = 48;

export function Topbar({
  flowName,
  onGoHome,
  onFlowNameClick,
  hasUnexportedChanges,
}: {
  flowName: string;
  onGoHome: () => void;
  /** Opens document preferences (US-092). */
  onFlowNameClick?: () => void;
  /** Saved locally but not exported as a file yet (US-094). */
  hasUnexportedChanges?: boolean;
}) {
  const t = useTranslations('unexportedChanges');

  return (
    <header className="relative flex h-12 shrink-0 items-center border-border-subtle border-b bg-bg-panel px-4">
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
        className="-translate-x-1/2 absolute left-1/2 flex max-w-xs items-center gap-1.5 text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        <span className="truncate">{flowName}</span>
        {hasUnexportedChanges && (
          <span
            role="status"
            className="size-1.5 shrink-0 rounded-full bg-signal-warning"
            title={t('indicatorTitle')}
            aria-label={t('indicatorLabel')}
          />
        )}
      </button>
    </header>
  );
}
