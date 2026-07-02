'use client';

// Flow-level document preferences — name, plus a Branding section (screen
// theme, company name, primary color; all three now live under Flow.branding
// in the DSL — see packages/dsl/src/schema/flow.ts). Radix Dialog (same stack
// as CommandPalette's cmdk wrapper): focus trap, Esc, backdrop dismiss.

import { FLOW_THEMES, type FlowTheme } from '@authprint/dsl';
import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

const inputCls =
  'w-full rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';

/** Falls back to the editor's own accent when a flow hasn't picked a brand color yet. */
const DEFAULT_PRIMARY_COLOR = '#6366f1';

export function DocumentPreferencesModal({
  open,
  onOpenChange,
  flowName,
  flowTheme,
  companyName,
  primaryColor,
  onFlowNameChange,
  onFlowThemeChange,
  onCompanyNameChange,
  onPrimaryColorChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  flowName: string;
  flowTheme: FlowTheme;
  companyName?: string;
  primaryColor?: string;
  onFlowNameChange: (name: string) => void;
  onFlowThemeChange: (theme: FlowTheme) => void;
  onCompanyNameChange: (companyName: string) => void;
  onPrimaryColorChange: (primaryColor: string) => void;
}) {
  const t = useTranslations('docPrefs');
  // Controlled drafts, committed on close (not blur) — Radix's focus trap can
  // redirect focus before a native blur reaches React's synthetic handler,
  // so "commit on blur" silently drops the edit inside this dialog. Closing
  // is the one lifecycle event Radix guarantees regardless of dismiss path
  // (Done, Esc, backdrop click), so it's the reliable place to commit. The
  // color swatch input isn't blur-vulnerable the same way, but it's kept on
  // the same commit-on-close draft as its paired hex field for one clear
  // "Done" moment rather than the swatch saving instantly and the hex field
  // lagging behind it.
  const [nameDraft, setNameDraft] = useState(flowName);
  const [companyNameDraft, setCompanyNameDraft] = useState(companyName ?? '');
  const [primaryColorDraft, setPrimaryColorDraft] = useState(primaryColor ?? DEFAULT_PRIMARY_COLOR);
  // Reset the drafts when the dialog transitions to open, without an effect
  // (react.dev "adjust state during render" pattern for prop-driven resets).
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setNameDraft(flowName);
      setCompanyNameDraft(companyName ?? '');
      setPrimaryColorDraft(primaryColor ?? DEFAULT_PRIMARY_COLOR);
    }
  }

  const handleOpenChange = (next: boolean) => {
    if (!next) {
      if (nameDraft.trim() && nameDraft !== flowName) onFlowNameChange(nameDraft);
      if (companyNameDraft !== (companyName ?? '')) onCompanyNameChange(companyNameDraft);
      if (primaryColorDraft !== (primaryColor ?? DEFAULT_PRIMARY_COLOR)) {
        onPrimaryColorChange(primaryColorDraft);
      }
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

            <div className="border-border-subtle border-t pt-4 dark:border-border-default">
              <h3 className="mb-2 font-medium text-[10px] text-fg-subtle uppercase tracking-wider">
                {t('branding')}
              </h3>
              <div className="space-y-3">
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

                <label className="block space-y-1">
                  <span className="text-fg-subtle text-xs">{t('companyName')}</span>
                  <input
                    className={inputCls}
                    value={companyNameDraft}
                    onChange={(e) => setCompanyNameDraft(e.target.value)}
                    placeholder={t('companyNamePlaceholder')}
                  />
                </label>

                <label className="block space-y-1">
                  <span className="text-fg-subtle text-xs">{t('primaryColor')}</span>
                  <div className="flex items-center gap-2">
                    <input
                      type="color"
                      aria-label={t('primaryColor')}
                      value={primaryColorDraft}
                      onChange={(e) => setPrimaryColorDraft(e.target.value)}
                      className="h-[26px] w-10 shrink-0 cursor-pointer rounded border border-border-default bg-bg-panel p-0.5"
                    />
                    <input
                      className={`${inputCls} font-mono`}
                      value={primaryColorDraft}
                      onChange={(e) => setPrimaryColorDraft(e.target.value)}
                      placeholder={DEFAULT_PRIMARY_COLOR}
                    />
                  </div>
                </label>
              </div>
            </div>
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
