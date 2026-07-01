'use client';

import type { Diagnostic } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';

export type Notice = {
  kind: 'error' | 'info';
  title: string;
  diagnostics: Diagnostic[];
};

/** Matches globals.css --duration-base (200ms) — exit dwell before unmount. */
const MOTION_DURATION_BASE_MS = 200;

export function NoticeToast({ notice, onDismiss }: { notice: Notice; onDismiss: () => void }) {
  const tPalette = useTranslations('palette');
  const [shown, setShown] = useState(false);
  const dismissingRef = useRef(false);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  const dismiss = useCallback(() => {
    if (dismissingRef.current) return;
    dismissingRef.current = true;
    setShown(false);
    window.setTimeout(onDismiss, MOTION_DURATION_BASE_MS);
  }, [onDismiss]);

  // Warm = error (per the aesthetic: warm colors signal state); indigo = info.
  const isError = notice.kind === 'error';

  return (
    <div
      className={`absolute top-4 left-1/2 z-30 w-[min(28rem,calc(100%-2rem))] -translate-x-1/2 rounded-lg border p-3 shadow-lg transition-[opacity,transform] duration-[var(--duration-fast)] ease-standard ${
        shown ? 'translate-y-0 opacity-100' : '-translate-y-1 opacity-0'
      } ${
        isError
          ? 'border-signal-error-border bg-signal-error-bg dark:border-signal-error-border-strong dark:bg-signal-error-bg'
          : 'border-accent-primary-border-muted bg-accent-primary-bg dark:border-accent-primary-border-muted dark:bg-accent-primary-bg/60'
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <p
          className={`font-medium text-sm ${isError ? 'text-signal-error dark:text-signal-error-fg' : 'text-accent-primary-fg-emphasis'}`}
        >
          {notice.title}
        </p>
        <button
          type="button"
          onClick={dismiss}
          aria-label={tPalette('dismiss')}
          className="text-sm text-fg-subtle leading-none hover:text-fg-muted dark:hover:text-fg-soft"
        >
          ✕
        </button>
      </div>
      {notice.diagnostics.length > 0 && (
        <ul className="mt-2 max-h-40 space-y-1 overflow-auto font-mono text-xs text-fg-muted dark:text-fg-subtle">
          {notice.diagnostics.map((d, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static, never-reordered diagnostics list
            <li key={i}>
              {d.path ? `${d.path} — ` : ''}
              {d.message}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
