'use client';

import type { Scenario } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/Logo';
import { PlayButton } from './PlayButton.tsx';
import { ProblemsPanel } from './ProblemsPanel.tsx';
import type { ValidationResult } from './useValidation.ts';

/** Fixed docked topbar height — canvas layout must match. */
export const TOPBAR_HEIGHT_PX = 48;

const chromeBtn =
  'inline-flex min-h-6 min-w-6 items-center justify-center gap-1.5 rounded-md px-2 py-1 text-sm text-fg-muted transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border';

export function Topbar({
  flowName,
  onGoHome,
  onFlowNameClick,
  hasUnexportedChanges,
  onOpen,
  onSave,
  onOpenPalette,
  validation,
  showOutlines,
  onToggleOutlines,
  scenarios,
  onPlayScenario,
  onRecordScenario,
}: {
  flowName: string;
  onGoHome: () => void;
  /** Opens document preferences (US-092). */
  onFlowNameClick?: () => void;
  /** Saved locally but not exported as a file yet (US-094). */
  hasUnexportedChanges?: boolean;
  onOpen: () => void;
  onSave: () => void;
  onOpenPalette: () => void;
  validation: ValidationResult;
  showOutlines: boolean;
  onToggleOutlines: () => void;
  scenarios: readonly Scenario[];
  onPlayScenario: (scenario: Scenario) => void;
  onRecordScenario: () => void;
}) {
  const t = useTranslations('topbar');
  const tUnexported = useTranslations('unexportedChanges');
  const tPalette = useTranslations('palette');

  return (
    <header className="relative grid h-12 shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 border-border-subtle border-b bg-bg-panel px-2 sm:px-3">
      <div className="flex min-w-0 items-center gap-0.5 overflow-hidden sm:gap-1">
        <button
          type="button"
          onClick={onGoHome}
          aria-label={t('home')}
          className={`${chromeBtn} shrink-0 font-semibold text-fg-default hover:text-accent-primary-fg`}
        >
          <Logo size={18} />
          <span className="hidden min-[520px]:inline">Authprint</span>
        </button>
        <span
          className="mx-0.5 hidden h-5 w-px shrink-0 bg-border-subtle sm:mx-1 sm:block"
          aria-hidden="true"
        />
        <button type="button" onClick={onOpen} aria-label={t('open')} className={chromeBtn}>
          <span aria-hidden="true">↥</span>
          <span>{t('open')}</span>
        </button>
        <button type="button" onClick={onSave} aria-label={t('save')} className={chromeBtn}>
          <span aria-hidden="true">↧</span>
          <span>{t('save')}</span>
        </button>
      </div>

      <button
        type="button"
        id="topbar-flow-name"
        onClick={onFlowNameClick}
        className="group flex min-h-6 max-w-[min(14rem,28vw)] items-center gap-1.5 truncate rounded-md px-1.5 text-fg-default text-sm transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border sm:max-w-[min(20rem,36vw)]"
      >
        {hasUnexportedChanges && (
          <span
            role="status"
            className="size-1.5 shrink-0 rounded-full bg-signal-warning"
            title={tUnexported('indicatorTitle')}
            aria-label={tUnexported('indicatorLabel')}
          />
        )}
        <span className="truncate font-medium">{flowName}</span>
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

      {/* `overflow-hidden` is the structural guarantee that this group can never
          spill into the centred flow name, whatever the viewport: content
          clips, it does not collide. */}
      <div className="flex min-w-0 items-center justify-end gap-1 overflow-hidden sm:gap-1.5">
        <ProblemsPanel
          validation={validation}
          showOutlines={showOutlines}
          onToggleOutlines={onToggleOutlines}
        />
        <span
          className="mx-0.5 hidden h-5 w-px shrink-0 bg-border-subtle sm:block"
          aria-hidden="true"
        />
        <PlayButton scenarios={scenarios} onPlay={onPlayScenario} onRecord={onRecordScenario} />
        <button
          type="button"
          onClick={onOpenPalette}
          aria-label={tPalette('openPalette')}
          title={tPalette('searchButton')}
          // Hidden on a narrow bar, at the same breakpoint the wordmark uses: a
          // keyboard-shortcut hint is the least load-bearing thing here, and
          // dropping it first keeps the Play control's scenario name legible
          // (US-129's "labelled, not a bare glyph") further down the range.
          className="hidden min-h-6 min-w-6 shrink-0 items-center justify-center rounded-full border border-border-subtle px-2.5 py-1 font-mono text-fg-muted text-xs transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border min-[520px]:inline-flex dark:border-border-default"
        >
          ⌘K
        </button>
      </div>
    </header>
  );
}
