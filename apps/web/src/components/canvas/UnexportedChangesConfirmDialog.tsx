'use client';

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';

export function UnexportedChangesConfirmDialog({
  open,
  onOpenChange,
  onConfirm,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onConfirm: () => void;
}) {
  const t = useTranslations('unexportedChanges');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-overlay-scrim backdrop-blur-sm" />
        <Dialog.Content
          className="fixed left-1/2 top-[30vh] z-50 w-[min(420px,90vw)] -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-panel p-5 shadow-2xl outline-none focus:outline-none"
          aria-describedby="unexported-changes-description"
        >
          <Dialog.Title className="font-semibold text-fg-default text-sm">
            {t('confirmTitle')}
          </Dialog.Title>
          <Dialog.Description
            id="unexported-changes-description"
            className="mt-2 text-fg-secondary text-sm leading-relaxed"
          >
            {t('confirmMessage')}
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
              className="rounded-md border border-accent-primary-border bg-accent-primary-bg px-3 py-1.5 text-accent-primary-fg-emphasis text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-accent-primary-bg/80 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
            >
              {t('continue')}
            </button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
