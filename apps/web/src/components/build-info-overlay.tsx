'use client';

// Build stamp overlay — Cmd+0 toggles commit/ref (and dev-only git fields) for
// verifying which checkout or deployment is being served.

import { useCallback, useEffect, useRef, useState } from 'react';
import type { BuildInfoResponse } from '@/lib/build-info';

function isDevBuildInfo(
  info: BuildInfoResponse,
): info is BuildInfoResponse & { worktree: string; dirty: boolean; repoRoot: string } {
  return 'worktree' in info;
}

export function BuildInfoOverlay() {
  const [open, setOpen] = useState(false);
  const [info, setInfo] = useState<BuildInfoResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const openRef = useRef(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/build-info');
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      setInfo((await res.json()) as BuildInfoResponse);
    } catch {
      setInfo(null);
      setError('Could not read build info');
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

  const devInfo = info && isDevBuildInfo(info) ? info : null;

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
        aria-labelledby="build-info-title"
        className="relative w-full max-w-md rounded-lg border border-zinc-200 bg-white p-4 font-mono text-sm shadow-2xl dark:border-zinc-700 dark:bg-zinc-900"
      >
        <h2
          id="build-info-title"
          className="mb-3 text-[10px] font-medium text-zinc-400 uppercase tracking-wider"
        >
          Build info
        </h2>
        {loading && <p className="text-zinc-500">Loading…</p>}
        {error && <p className="text-red-600 dark:text-red-400">{error}</p>}
        {info && !loading && (
          <dl className="space-y-2 text-zinc-800 dark:text-zinc-100">
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">Ref</dt>
              <dd className="text-right">{info.ref}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-zinc-500">SHA</dt>
              <dd className="text-right">{info.sha}</dd>
            </div>
            {info.builtAt && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Built at</dt>
                <dd className="text-right">{info.builtAt}</dd>
              </div>
            )}
            {info.version && (
              <div className="flex justify-between gap-4">
                <dt className="text-zinc-500">Version</dt>
                <dd className="text-right">{info.version}</dd>
              </div>
            )}
            {devInfo && (
              <>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Worktree</dt>
                  <dd className="text-right">{devInfo.worktree}</dd>
                </div>
                <div className="flex justify-between gap-4">
                  <dt className="text-zinc-500">Dirty</dt>
                  <dd className="text-right">{devInfo.dirty ? 'yes' : 'no'}</dd>
                </div>
                <div className="border-zinc-200 border-t pt-2 dark:border-zinc-700">
                  <dt className="text-zinc-500 text-xs">Repo root</dt>
                  <dd className="mt-1 break-all text-xs text-zinc-600 dark:text-zinc-400">
                    {devInfo.repoRoot}
                  </dd>
                </div>
              </>
            )}
          </dl>
        )}
        <p className="mt-4 text-[10px] text-zinc-400">⌘0 toggle · Esc dismiss</p>
      </div>
    </div>
  );
}
