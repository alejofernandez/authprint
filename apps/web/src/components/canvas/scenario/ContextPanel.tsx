'use client';

// Read-only Context panel for scenario playback. Shows the context state at the
// active step; slots patched by the previous step are highlighted.

import type { Divergence } from '@authprint/dsl';

function divergenceContextSlots(divergence: Divergence | null): ReadonlySet<string> {
  if (!divergence) return new Set();
  if (divergence.kind === 'unknown-slot') return new Set([divergence.slot]);
  return new Set();
}

export function contextSlotsChangedByPreviousStep(
  previous: Record<string, unknown> | null | undefined,
  current: Record<string, unknown>,
): Set<string> {
  if (!previous) return new Set();
  const changed = new Set<string>();
  const keys = new Set([...Object.keys(previous), ...Object.keys(current)]);
  for (const slot of keys) {
    if (!Object.is(previous[slot], current[slot])) changed.add(slot);
  }
  return changed;
}

export function ContextPanel({
  context,
  previousContext,
  divergence,
  embedded = false,
  drawer = false,
  emphasizedSlots,
}: {
  context: Record<string, unknown>;
  previousContext?: Record<string, unknown> | null;
  divergence: Divergence | null;
  /** When true, panel flows in the player layout instead of floating over the canvas. */
  embedded?: boolean;
  /** Drawer body inside the player — no outer chrome; list fills the drawer. */
  drawer?: boolean;
  /** Slots to emphasize (e.g. the predicate slot on an active decision step). */
  emphasizedSlots?: ReadonlySet<string>;
}) {
  const flagged = divergenceContextSlots(divergence);
  const patched = contextSlotsChangedByPreviousStep(previousContext, context);
  const entries = Object.entries(context).sort(([a], [b]) => a.localeCompare(b));

  return (
    <div
      className={
        drawer
          ? 'flex min-h-0 flex-1 flex-col'
          : embedded
            ? 'w-56 shrink-0 self-start rounded-lg border border-border-subtle bg-bg-panel/95 p-3 shadow-lg dark:border-border-default dark:bg-bg-panel/95'
            : 'absolute top-4 left-4 z-30 w-56 rounded-lg border border-border-subtle bg-bg-panel/95 p-3 shadow-lg backdrop-blur dark:border-border-default dark:bg-bg-panel/95'
      }
    >
      {!drawer ? (
        <div className="mb-2 text-xs font-semibold uppercase tracking-wide text-fg-subtle dark:text-fg-subtle">
          Context
        </div>
      ) : null}
      {entries.length === 0 ? (
        <p className="text-xs text-fg-subtle">No context values</p>
      ) : (
        <ul
          className={
            drawer
              ? 'min-h-0 flex-1 space-y-1.5 overflow-auto'
              : 'max-h-48 space-y-1.5 overflow-auto'
          }
        >
          {entries.map(([slot, value]) => (
            <li key={slot} className="font-mono text-[11px] leading-snug">
              <span
                className={
                  flagged.has(slot)
                    ? 'font-semibold text-signal-danger dark:text-signal-danger-fg'
                    : emphasizedSlots?.has(slot)
                      ? 'font-semibold text-node-decision-fg dark:text-node-decision-fg'
                      : patched.has(slot)
                        ? 'font-semibold text-accent-primary-fg-emphasis dark:text-accent-primary'
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
              ) : emphasizedSlots?.has(slot) ? (
                <span className="ml-1 text-[10px] text-node-decision-fg">◆</span>
              ) : patched.has(slot) ? (
                <span className="ml-1 text-[10px] text-accent-primary-solid dark:text-accent-primary">
                  ●
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
