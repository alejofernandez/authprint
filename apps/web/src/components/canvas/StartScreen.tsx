'use client';

// Docs-style landing screen (E42 / US-090): create, open from disk, or resume Recent.

import { useTranslations } from 'next-intl';
import { type DragEvent, useEffect, useState } from 'react';
import type { ExampleFlow, PatternFlow } from './flowCatalog.ts';
import { formatRelativeTime } from './formatRelativeTime.ts';
import {
  clearRecentFlows,
  listRecentFlows,
  type RecentFlowEntry,
  removeRecentFlow,
} from './recentFlows/store.ts';

type StartScreenProps = {
  examples: ExampleFlow[];
  patterns: PatternFlow[];
  dragging: boolean;
  onDragStateChange: (dragging: boolean) => void;
  onDropFiles: (files: File[]) => void;
  onBlank: () => void;
  onPattern: (pattern: PatternFlow) => void;
  onExample: (example: ExampleFlow) => void;
  onOpenDisk: () => void;
  onResumeRecent: (entry: RecentFlowEntry) => void;
};

function FlowTile({
  title,
  subtitle,
  onClick,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="flex min-h-[88px] flex-col justify-center rounded-xl border border-border-subtle bg-bg-panel px-4 py-3 text-left shadow-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:border-accent-primary-border hover:bg-accent-primary-bg/40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
    >
      <span className="font-medium text-fg-default text-sm">{title}</span>
      {subtitle ? <span className="mt-1 text-fg-subtle text-xs">{subtitle}</span> : null}
    </button>
  );
}

export function StartScreen({
  examples,
  patterns,
  dragging,
  onDragStateChange,
  onDropFiles,
  onBlank,
  onPattern,
  onExample,
  onOpenDisk,
  onResumeRecent,
}: StartScreenProps) {
  const t = useTranslations('startScreen');
  const [recent, setRecent] = useState<RecentFlowEntry[]>([]);

  useEffect(() => {
    let cancelled = false;
    void listRecentFlows().then((entries) => {
      if (!cancelled) setRecent(entries);
    });
    return () => {
      cancelled = true;
    };
  }, []);

  const reloadRecent = async () => {
    setRecent(await listRecentFlows());
  };

  const onRemoveRecent = async (sessionId: string) => {
    await removeRecentFlow(sessionId);
    await reloadRecent();
  };

  const onClearRecent = async () => {
    await clearRecentFlows();
    await reloadRecent();
  };

  const onDrop = (event: DragEvent<HTMLDivElement>) => {
    event.preventDefault();
    onDragStateChange(false);
    const files = [...event.dataTransfer.files];
    if (files.length > 0) onDropFiles(files);
  };

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: file drop zone; Open from disk tile is the keyboard path.
    <div
      className="relative flex min-h-dvh w-full flex-col bg-bg-canvas"
      onDragOver={(e) => {
        e.preventDefault();
        onDragStateChange(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) onDragStateChange(false);
      }}
      onDrop={onDrop}
    >
      <header className="px-6 pt-8 pb-4">
        <h1 className="font-semibold text-2xl text-fg-default tracking-tight">Authprint</h1>
        <p className="mt-1 text-fg-muted text-sm">{t('tagline')}</p>
      </header>

      <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-10 px-6 pb-12">
        <section>
          <h2 className="mb-3 font-medium text-fg-secondary text-sm">{t('sections.create')}</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            <FlowTile title={t('blankFlow')} subtitle={t('blankFlowHint')} onClick={onBlank} />
            {patterns.map((pattern) => (
              <FlowTile
                key={pattern.id}
                title={pattern.name}
                subtitle={t('fromPattern')}
                onClick={() => onPattern(pattern)}
              />
            ))}
            {examples.map((example) => (
              <FlowTile
                key={example.id}
                title={example.name}
                subtitle={t('openExample')}
                onClick={() => onExample(example)}
              />
            ))}
          </div>
        </section>

        <section>
          <h2 className="mb-3 font-medium text-fg-secondary text-sm">{t('sections.open')}</h2>
          <FlowTile
            title={t('openFromDisk')}
            subtitle={t('openFromDiskHint')}
            onClick={onOpenDisk}
          />
        </section>

        <section>
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 className="font-medium text-fg-secondary text-sm">{t('sections.recent')}</h2>
            {recent.length > 0 ? (
              <button
                type="button"
                onClick={() => void onClearRecent()}
                className="text-accent-primary-fg text-xs hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
              >
                {t('clearAll')}
              </button>
            ) : null}
          </div>
          {recent.length === 0 ? (
            <p className="rounded-xl border border-border-subtle border-dashed bg-bg-panel/50 px-4 py-6 text-center text-fg-subtle text-sm">
              {t('recentEmpty')}
            </p>
          ) : (
            <ul className="divide-y divide-border-subtle overflow-hidden rounded-xl border border-border-subtle bg-bg-panel">
              {recent.map((entry) => (
                <li key={entry.sessionId} className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => onResumeRecent(entry)}
                    className="flex min-w-0 flex-1 items-center justify-between gap-3 px-4 py-3 text-left transition-colors duration-[var(--duration-fast)] ease-standard hover:bg-bg-subtle focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-accent-primary-border"
                  >
                    <span className="truncate font-medium text-fg-default text-sm">
                      {entry.name}
                    </span>
                    <span className="shrink-0 text-fg-subtle text-xs">
                      {formatRelativeTime(entry.lastEditedAt)}
                    </span>
                  </button>
                  <button
                    type="button"
                    onClick={() => void onRemoveRecent(entry.sessionId)}
                    aria-label={t('removeRecent', { name: entry.name })}
                    className="mr-3 rounded-md px-2 py-1 text-fg-subtle text-xs hover:bg-bg-subtle hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
                  >
                    {t('remove')}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </section>
      </main>

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-accent-primary/10 backdrop-blur-sm">
          <div className="rounded-xl border-2 border-accent-primary-border border-dashed bg-bg-panel/90 px-8 py-6 font-medium text-accent-primary-fg">
            {t('dropOverlay')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
