'use client';

import { useTranslations } from 'next-intl';
import { Logo } from '@/components/Logo';

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
        className="flex items-center gap-2 font-semibold text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:text-accent-primary-fg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        <Logo size={18} />
        Authprint
      </button>
      <button
        type="button"
        id="topbar-flow-name"
        onClick={onFlowNameClick}
        className="group -translate-x-1/2 absolute left-1/2 flex max-w-xs items-center gap-1.5 text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        {hasUnexportedChanges && (
          <span
            role="status"
            className="size-1.5 shrink-0 rounded-full bg-signal-warning"
            title={t('indicatorTitle')}
            aria-label={t('indicatorLabel')}
          />
        )}
        <span className="truncate">{flowName}</span>
        <svg
          aria-hidden="true"
          viewBox="0 0 24 24"
          width="13"
          height="13"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          className="shrink-0 text-fg-subtle transition-colors duration-[var(--duration-fast)] ease-standard group-hover:text-fg-muted dark:group-hover:text-fg-soft"
        >
          <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
        </svg>
      </button>
    </header>
  );
}
