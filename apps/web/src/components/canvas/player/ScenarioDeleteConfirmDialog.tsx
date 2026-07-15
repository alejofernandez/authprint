'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';

export function ScenarioDeleteConfirmDialog({
  open,
  onOpenChange,
  scenarioName,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  scenarioName: string;
  onConfirm: () => void;
}) {
  const t = useTranslations('player.scenarioCrud');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-[60] bg-overlay-scrim backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[30vh] z-[60] w-[min(420px,90vw)] -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-panel p-5 shadow-2xl outline-none focus:outline-none"
          aria-describedby="scenario-delete-description"
        >
          <Dialog.Title className="font-semibold text-fg-default text-sm">
            {t('deleteTitle')}
          </Dialog.Title>
          <Dialog.Description
            id="scenario-delete-description"
            className="mt-2 text-fg-secondary text-sm leading-relaxed"
          >
            {t('deleteMessage', { name: scenarioName })}
          </Dialog.Description>
          <div className="mt-5 flex justify-end gap-2">
            <Dialog.Close asChild>
              <button
                type="button"
                className="rounded-md border border-border-default px-3 py-1.5 text-fg-secondary text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
              >
                {t('cancel')}
              </button>
            </Dialog.Close>
            <button
              type="button"
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
              className="rounded-md border border-signal-error-border bg-signal-error-bg px-3 py-1.5 text-sm text-signal-error-label transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-signal-error-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-signal-error-border"
            >
              {t('deleteConfirm')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
