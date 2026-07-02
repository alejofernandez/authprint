'use client';

// About / credits surface (E43 / US-096). Radix Dialog — production-visible
// acknowledgment for React Flow and the rest of the editor stack.

import * as Dialog from '@radix-ui/react-dialog';
import { useTranslations } from 'next-intl';
import { Logo } from '@/components/Logo';

const GITHUB_REPO = 'https://github.com/alejofernandez/authprint';

/** Runtime deps from apps/web/package.json (verified 2026-07-01). */
const BUILT_WITH = [
  { name: 'React Flow', href: 'https://xyflow.com/' },
  { name: 'elkjs', href: 'https://github.com/kieler/elkjs' },
  { name: 'Yjs', href: 'https://github.com/yjs/yjs' },
  { name: 'Radix UI', href: 'https://www.radix-ui.com/' },
  { name: 'cmdk', href: 'https://github.com/pacocoursey/cmdk' },
  { name: 'next-intl', href: 'https://next-intl.dev/' },
] as const;

export function AboutModal({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations('about');

  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-40 bg-overlay-scrim backdrop-blur-sm transition-opacity duration-[var(--duration-base)] ease-standard data-[state=open]:opacity-100 data-[state=closed]:opacity-0" />
        <Dialog.Content
          className="fixed left-1/2 top-[18vh] z-50 w-[min(420px,90vw)] -translate-x-1/2 rounded-xl border border-border-subtle bg-bg-panel p-5 shadow-2xl outline-none transition-[opacity,transform] duration-[var(--duration-base)] ease-standard focus:outline-none data-[state=open]:scale-100 data-[state=open]:opacity-100 data-[state=closed]:scale-[0.98] data-[state=closed]:opacity-0"
          aria-describedby="about-description"
        >
          <div className="flex items-center gap-3.5">
            <Logo variant="color" size={44} />
            <div>
              <Dialog.Title className="font-semibold text-fg-default text-lg">
                Authprint
              </Dialog.Title>
              <Dialog.Description
                id="about-description"
                className="mt-0.5 text-fg-secondary text-sm"
              >
                {t('tagline')}
              </Dialog.Description>
            </div>
          </div>

          <p className="mt-4 text-fg-muted text-sm">{t('license')}</p>

          <p className="mt-3">
            <a
              href={GITHUB_REPO}
              target="_blank"
              rel="noopener noreferrer"
              className="text-accent-primary-solid text-sm underline-offset-2 hover:underline dark:text-accent-primary"
            >
              {t('repoLink')}
            </a>
          </p>

          <div className="mt-5">
            <h3 className="mb-2 font-medium text-fg-default text-xs uppercase tracking-wide">
              {t('builtWith')}
            </h3>
            <ul className="space-y-1.5">
              {BUILT_WITH.map(({ name, href }) => (
                <li key={name}>
                  <a
                    href={href}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-fg-secondary text-sm underline-offset-2 hover:text-accent-primary-solid hover:underline dark:hover:text-accent-primary"
                  >
                    {name}
                  </a>
                </li>
              ))}
            </ul>
          </div>

          <Dialog.Close asChild>
            <button
              type="button"
              className="mt-5 w-full rounded-md border border-border-default py-1.5 text-fg-secondary text-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
            >
              {t('close')}
            </button>
          </Dialog.Close>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
