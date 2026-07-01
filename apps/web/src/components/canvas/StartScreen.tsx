'use client';

// Docs-style landing screen (E42 / US-090): create, open from disk, or pick Recent.

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
import { FlowTileArtwork, type TileVisual } from './startScreen/FlowTileArtwork.tsx';

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

const tileGridClass = 'grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5';

const tileButtonClass =
  'flex h-full w-full flex-col overflow-hidden border border-border-subtle bg-bg-panel text-left shadow-sm transition-colors duration-[var(--duration-fast)] ease-standard hover:border-accent-primary-border hover:bg-accent-primary-bg/20 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border';

function SquareTile({
  title,
  subtitle,
  visual,
  onClick,
  className = '',
}: {
  title: string;
  subtitle?: string;
  visual: TileVisual;
  onClick: () => void;
  className?: string;
}) {
  return (
    <div className="aspect-square">
      <button type="button" onClick={onClick} className={`${tileButtonClass} ${className}`}>
        <div className="min-h-0 flex-1 bg-bg-canvas">
          <FlowTileArtwork visual={visual} />
        </div>
        <div className="shrink-0 border-border-subtle border-t bg-bg-panel p-2.5">
          <span className="line-clamp-2 font-medium text-fg-default text-sm leading-snug">
            {title}
          </span>
          {subtitle ? (
            <span className="mt-0.5 line-clamp-1 text-fg-subtle text-xs">{subtitle}</span>
          ) : null}
        </div>
      </button>
    </div>
  );
}

function RecentTile({
  entry,
  onOpen,
  onRemove,
  removeLabel,
}: {
  entry: RecentFlowEntry;
  onOpen: () => void;
  onRemove: () => void;
  removeLabel: string;
}) {
  return (
    <div className="relative aspect-square">
      <button type="button" onClick={onOpen} className={tileButtonClass}>
        <div className="min-h-0 flex-1 bg-bg-canvas">
          <FlowTileArtwork visual={{ kind: 'flow', source: entry.bundle }} />
        </div>
        <div className="shrink-0 border-border-subtle border-t bg-bg-panel p-2.5 text-left">
          <span className="line-clamp-2 font-medium text-fg-default text-sm leading-snug">
            {entry.name}
          </span>
          <span className="mt-0.5 line-clamp-1 text-fg-subtle text-xs">
            {formatRelativeTime(entry.lastEditedAt)}
          </span>
        </div>
      </button>
      <button
        type="button"
        onClick={(event) => {
          event.stopPropagation();
          onRemove();
        }}
        aria-label={removeLabel}
        className="absolute top-1.5 right-1.5 border border-border-subtle bg-bg-panel/90 px-1.5 py-0.5 text-fg-subtle text-xs hover:bg-bg-subtle hover:text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border"
      >
        ×
      </button>
    </div>
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
      <div className="mx-auto flex w-full max-w-5xl flex-1 flex-col justify-center px-6 py-8 lg:px-8 lg:py-12">
        <header className="mb-8 max-w-prose lg:mb-10">
          <h1 className="font-semibold text-2xl text-fg-default tracking-tight lg:text-3xl">
            Authprint
          </h1>
          <p className="mt-1.5 text-fg-muted text-sm leading-relaxed lg:text-base">
            {t('tagline')}
          </p>
        </header>

        <main className="flex flex-col gap-8 pb-2">
          <section>
            <h2 className="mb-3 font-medium text-fg-secondary text-sm">{t('sections.create')}</h2>
            <div className={tileGridClass}>
              <SquareTile
                title={t('blankFlow')}
                subtitle={t('blankFlowHint')}
                visual={{ kind: 'blank' }}
                onClick={onBlank}
              />
              <SquareTile
                title={t('openFromDisk')}
                subtitle={t('openFromDiskHint')}
                visual={{ kind: 'open' }}
                onClick={onOpenDisk}
              />
              {patterns.map((pattern) => (
                <SquareTile
                  key={pattern.id}
                  title={pattern.name}
                  subtitle={t('fromPattern')}
                  visual={{ kind: 'flow', source: pattern.source }}
                  onClick={() => onPattern(pattern)}
                />
              ))}
              {examples.map((example) => (
                <SquareTile
                  key={example.id}
                  title={example.name}
                  subtitle={t('openExample')}
                  visual={{ kind: 'flow', source: example.source }}
                  onClick={() => onExample(example)}
                />
              ))}
            </div>
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
              <p className="border border-border-subtle border-dashed bg-bg-panel/50 px-4 py-5 text-center text-fg-subtle text-sm">
                {t('recentEmpty')}
              </p>
            ) : (
              <div className={tileGridClass}>
                {recent.map((entry) => (
                  <RecentTile
                    key={entry.sessionId}
                    entry={entry}
                    onOpen={() => onResumeRecent(entry)}
                    onRemove={() => void onRemoveRecent(entry.sessionId)}
                    removeLabel={t('removeRecent', { name: entry.name })}
                  />
                ))}
              </div>
            )}
          </section>
        </main>
      </div>

      {dragging ? (
        <div className="pointer-events-none absolute inset-0 z-20 grid place-items-center bg-accent-primary/10 backdrop-blur-sm">
          <div className="border-2 border-accent-primary-border border-dashed bg-bg-panel/90 px-8 py-6 font-medium text-accent-primary-fg">
            {t('dropOverlay')}
          </div>
        </div>
      ) : null}
    </div>
  );
}
