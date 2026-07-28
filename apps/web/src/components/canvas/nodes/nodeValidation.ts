// Shared validation presentation for node components (E33 / US-057). A node
// flagged by `validate()` gets a ring (red error / amber warning — warm = state
// signal per the aesthetic) and a `title` tooltip listing the reasons. Error
// beats warning when both apply.
//
// `info` deliberately gets NO ring (US-043): those diagnostics describe values
// the tool accepts, and ringing a node for a legal custom kind is exactly the
// false alarm users pushed back on. They still appear in the tooltip and in the
// Problems panel, so nothing becomes invisible.

import type { Diagnostic } from '@authprint/dsl';

export const SEVERITY_GLYPH = { error: '⛔', warning: '⚠️', info: 'ℹ️' } as const;

const RING = {
  error: 'ring-2 ring-signal-danger-ring ring-offset-2 ring-offset-bg-canvas',
  warning: 'ring-2 ring-signal-warning-ring ring-offset-2 ring-offset-bg-canvas',
} as const;

/** Tailwind ring classes for a node's diagnostics, or '' when clean. */
export function validationRing(diagnostics: Diagnostic[] | undefined): string {
  if (!diagnostics || diagnostics.length === 0) return '';
  if (diagnostics.some((d) => d.severity === 'error')) return RING.error;
  return diagnostics.some((d) => d.severity === 'warning') ? RING.warning : '';
}

/** Hover-tooltip text listing the reasons, or undefined when clean. */
export function validationTitle(diagnostics: Diagnostic[] | undefined): string | undefined {
  if (!diagnostics || diagnostics.length === 0) return undefined;
  return diagnostics.map((d) => `${SEVERITY_GLYPH[d.severity]} ${d.message}`).join('\n');
}

export function canvasNodeRing(diagnostics: Diagnostic[] | undefined): string {
  return validationRing(diagnostics);
}

export function canvasNodeOpacity(): string {
  return '';
}

export function canvasNodeTitle(diagnostics: Diagnostic[] | undefined): string | undefined {
  return validationTitle(diagnostics);
}
