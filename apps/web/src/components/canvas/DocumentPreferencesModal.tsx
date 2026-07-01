'use client';

// Flow-level document preferences — name + screen mockup theme (E43 / US-092).
// Radix Dialog (same stack as CommandPalette's cmdk wrapper): focus trap, Esc,
// backdrop dismiss.

import { FLOW_THEMES, type FlowTheme } from '@authprint/dsl';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const inputCls =
  'w-full rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';

export function DocumentPreferencesModal({
  open,
  onOpenChange,
  flowName,
  flowTheme,
  onFlowNameChange,
  onFlowThemeChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowName: string;
  flowTheme: FlowTheme;
  onFlowNameChange: (name: string) => void;
  onFlowThemeChange: (theme: FlowTheme) => void;
}) {
  const t = useTranslations('docPrefs');
  // Controlled draft, committed on close (not blur) — Radix's focus trap can
  // redirect focus before a native blur reaches React's synthetic handler,
  // so "commit on blur" silently drops the edit inside this dialog. Closing
  // is the one lifecycle event Radix guarantees regardless of dismiss path
  // (Done, Esc, backdrop click), so it's the reliable place to commit.
  const [nameDraft, setNameDraft] = useState(flowName);
  // Reset the draft when the dialog transitions to open, without an effect
  // (react.dev "adjust state during render" pattern for prop-driven resets).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) setNameDraft(flowName);
  }

  const handleOpenChange = (next: boolean) => {
    if (!next && nameDraft.trim() && nameDraft !== flowName) {
      onFlowNameChange(nameDraft);
    }
    onOpenChange(next);
  };

  return (
    <Dialog.Root open={open} onOpenChange={handleOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay-scrim backdrop-blur-sm transition-opacity duration-[var(--duration-base)] ease-standard data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[18vh] z-50 w-[min(420px,90vw)] -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-panel p-5 shadow-2xl outline-none transition-[opacity,transform] duration-[var(--duration-base)] ease-standard focus:outline-none data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
          aria-describedby={undefined}
        >
          <Dialog.Title className="mb-4 font-semibold text-fg-default text-sm">
            {t('title')}
          </Dialog.Title>

          <div className="space-y-4">
            <label className="block space-y-1">
              <span className="text-fg-subtle text-xs">{t('flowName')}</span>
              <input
                className={inputCls}
                value={nameDraft}
                onChange={(e) => setNameDraft(e.target.value)}
                // biome-ignore lint/a11y/noAutofocus: name is the primary field when opening preferences
                autoFocus
                onKeyDown={(e) => {
                  if (e.key === 'Enter') e.currentTarget.blur();
                }}
              />
            </label>

            <label className="block space-y-1">
              <span className="text-fg-subtle text-xs">{t('screenTheme')}</span>
              <select
                className={inputCls}
                value={flowTheme}
                onChange={(e) => onFlowThemeChange(e.target.value as FlowTheme)}
              >
                {FLOW_THEMES.map((theme) => (
                  <option key={theme} value={theme}>
                    {t(`themes.${theme}`)}
                  </option>
                ))}
              </select>
            </label>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-5 w-full rounded-md border border-border-default py-1.5 text-fg-secondary text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
            >
              {t('done')}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
