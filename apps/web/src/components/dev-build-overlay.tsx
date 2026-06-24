'use client';

// Dev-only build stamp — Cmd+0 toggles branch / worktree / commit for verifying
// which checkout the running dev server is serving.

import { useCallback, useEffect, useRef, useState } from 'react';

type GitBuildInfo = {
  branch: string;
  commit: string;
  worktree: string;
  dirty: boolean;
  repoRoot: string;
};

export function DevBuildOverlay() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<GitBuildInfo | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const openRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/dev-build-info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo((await res.json()) as GitBuildInfo);
    } catch {
      setInfo(null);
      setError('Could not read git state');
    } finally {
      setLoading(false);
    }
  }, []);

  const toggle = useCallback(() => {
    const next = !openRef.current;
    openRef.current = next;
    setOpen(next);
    if (next) void load();
  }, [load]);

  const close = useCallback(() => {
    openRef.current = false;
    setOpen(false);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.metaKey && e.key === '0') {
        e.preventDefault();
        toggle();
      } else if (e.key === 'Escape') {
        close();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [toggle, close]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <button
        type="button"
        aria-label="Close build info"
        className="absolute inset-0 cursor-default bg-black/30"
        onClick={close}
      />
      <div
        role="dialog"
        aria-labelledby="dev-build-title"
        className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 font-mono text-sm shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2
          id="dev-build-title"
          className="mb-3 text-[10px] font-medium text-zinc-400 uppercase tracking-wider"
        >
          Dev build
        </h2>
        {loading && <p className="text-zinc-500">Reading git…</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        {info && !loading && (
          <dl className="space-y-2 text-zinc-800 dark:text-zinc-100">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Branch</dt>
              <dd className="text-right">{info.branch}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Worktree</dt>
              <dd className="text-right">{info.worktree}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Commit</dt>
              <dd className="text-right">{info.commit}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Dirty</dt>
              <dd className="text-right">{info.dirty ? 'yes' : 'no'}</dd>
            </div>
            <div className="border-zinc-200 border-t pt-2 dark:border-zinc-700">
              <dt className="text-zinc-500 text-xs">Repo root</dt>
              <dd className="mt-1 break-all text-xs text-zinc-600 dark:text-zinc-400">
                {info.repoRoot}
              </dd>
            </div>
          </dl>
        )}
        <p className="mt-4 text-[10px] text-zinc-400">⌘0 toggle · Esc dismiss</p>
      </div>
    </div>
  );
}
