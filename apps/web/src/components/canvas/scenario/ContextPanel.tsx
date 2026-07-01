'use client';

// Read-only Context panel for scenario mode (US-062). Lists the scenario's
// `initialContext` slots + values; slots referenced by a divergence are marked.

import type { Divergence } from '@authprint/dsl';
import { TOPBAR_HEIGHT_PX } from '../Topbar.tsx';
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
    <div
      className="absolute left-4 z-30 w-56 rounded-lg border border-border-subtle bg-bg-panel/95 p-3 shadow-lg backdrop-blur dark:border-border-default dark:bg-bg-panel/95"
      style={{ top: TOPBAR_HEIGHT_PX + 8 }}
    >
      <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle dark:text-fg-subtle">
        Context
      </div>
      {entries.length === 0 ? (
        <p className="text-xs text-fg-subtle">No initial context</p>
      ) : (
        <ul className="max-h-48 space-y-1.5 overflow-auto">
          {entries.map(([slot, value]) => (
            <li key={slot} className="font-mono text-[11px] leading-snug">
              <span
                className={
                  flagged.has(slot)
                    ? 'font-semibold text-signal-danger dark:text-signal-danger-fg'
                    : 'text-fg-secondary dark:text-fg-muted'
                }
              >
                {slot}
              </span>
              <span className="text-fg-subtle"> = </span>
              <span className="text-fg-muted dark:text-fg-subtle">{formatValue(value)}</span>
              {flagged.has(slot) ? (
                <span className="ml-1 text-[10px] text-signal-danger-ring dark:text-signal-danger-fg">
                  ⚑
                </span>
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
