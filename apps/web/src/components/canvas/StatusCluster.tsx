'use client';

// Bottom-right status cluster (E43 / US-093): compact pill row anchored where the
// React Flow minimap lived. US-094 adds a second occupant; keep the layout
// roomy enough for 2–3 items without a redesign.

import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

export function UnexportedIndicator({ visible }: { visible: boolean }) {
  const t = useTranslations('unexportedChanges');
  if (!visible) return null;
  return (
    <span
      className="rounded-md border border-signal-warning-border bg-signal-warning-bg/80 px-2 py-1 font-medium text-[11px] text-signal-warning-fg"
      title={t('indicatorTitle')}
    >
      {t('indicatorLabel')}
    </span>
  );
}

export function StatusCluster({
  children,
  unexportedIndicator,
}: {
  children: ReactNode;
  /** Shown when the active session has edits not exported to a file (US-094). */
  unexportedIndicator?: ReactNode;
}) {
  return (
    <div className="absolute right-4 bottom-4 z-20 flex items-center gap-2 rounded-lg border border-border-subtle bg-bg-panel/95 p-1 shadow-lg backdrop-blur dark:border-border-default dark:bg-bg-panel/95">
      {unexportedIndicator}
      {children}
    </div>
  );
}
