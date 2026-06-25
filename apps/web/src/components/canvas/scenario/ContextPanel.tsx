'use client';

// Read-only Context panel for scenario mode (US-062). Lists the scenario's
// `initialContext` slots + values; slots referenced by a divergence are marked.

import type { Divergence } from '@authprint/dsl';
import { divergenceContextSlots } from './scenarioTrace.ts';

export function ContextPanel({
  initialContext,
  divergence,
}: {
  initialContext: Record<string, unknown>;
  divergence: Divergence | null;
}) {
  const flagged = divergenceContextSlots(divergence);
  const entries = Object.entries(initialContext).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div className="absolute bottom-6 left-4 z-30 w-56 rounded-lg border border-zinc-200 bg-white/95 p-3 shadow-lg backdrop-blur dark:border-zinc-700 dark:bg-zinc-900/95">
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-zinc-500 dark:text-zinc-400">
        Context
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-zinc-400 dark:text-zinc-500">No initial context</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-auto">
          {entries.map(([slot, value]) => (
            <li key={slot} className="font-mono text-[11px] leading-snug">
              <span
                className={
                  flagged.has(slot)
                    ? 'font-semibold text-red-600 dark:text-red-400'
                    : 'text-zinc-700 dark:text-zinc-300'
                }
              >
                {slot}
              </span>
              <span className="text-zinc-400 dark:text-zinc-500"> = </span>
              <span className="text-zinc-600 dark:text-zinc-400">{formatValue(value)}</span>
              {flagged.has(slot) ? (
                <span className="ml-1 text-[10px] text-red-500 dark:text-red-400">⚑</span>
              ) : null}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function formatValue(value: unknown): string {
  if (typeof value === 'string') return JSON.stringify(value);
  return JSON.stringify(value);
}
