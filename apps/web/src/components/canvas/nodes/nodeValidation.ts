// Shared validation presentation for node components (E33 / US-057). A node
// flagged by `validate()` gets a ring (red error / amber warning — warm = state
// signal per the aesthetic) and a `title` tooltip listing the reasons. Error
// beats warning when both apply.

import type { Diagnostic } from '@authprint/dsl';

const RING = {
  error: 'ring-2 ring-red-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950',
  warning: 'ring-2 ring-amber-500 ring-offset-2 ring-offset-zinc-50 dark:ring-offset-zinc-950',
} as const;

/** Tailwind ring classes for a node's diagnostics, or '' when clean. */
export function validationRing(diagnostics: Diagnostic[] | undefined): string {
  if (!diagnostics || diagnostics.length === 0) return '';
  return diagnostics.some((d) => d.severity === 'error') ? RING.error : RING.warning;
}

/** Hover-tooltip text listing the reasons, or undefined when clean. */
export function validationTitle(diagnostics: Diagnostic[] | undefined): string | undefined {
  if (!diagnostics || diagnostics.length === 0) return undefined;
  return diagnostics.map((d) => `${d.severity === 'error' ? '⛔' : '⚠️'} ${d.message}`).join('\n');
}
