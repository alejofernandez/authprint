// Shared validation presentation for node components (E33 / US-057). A node
// flagged by `validate()` gets a ring (red error / amber warning — warm = state
// signal per the aesthetic) and a `title` tooltip listing the reasons. Error
// beats warning when both apply.
//
// `info` deliberately gets NO ring (US-043): those diagnostics describe values
// the tool accepts, and ringing a node for a legal custom kind is exactly the
// false alarm users pushed back on. They still appear in the tooltip and in the
// Problems panel, so nothing becomes invisible.
//
// A node with no incident edges (US-133 free placement) is *not wired yet*, not
// broken: both connectivity errors it raises are explained by the missing edges
// the user is about to draw. Its canvas cue softens to a muted ring, while the
// severity and the Problems entry stay untouched. A wired node keeps the danger
// ring for the same codes — there, a dead end is a real modelling error.

import type { Diagnostic } from '@authprint/dsl';

export const SEVERITY_GLYPH = { error: '⛔', warning: '⚠️', info: 'ℹ️' } as const;

const RING = {
  error: 'ring-2 ring-signal-danger-ring ring-offset-2 ring-offset-bg-canvas',
  warning: 'ring-2 ring-signal-warning-ring ring-offset-2 ring-offset-bg-canvas',
  // Soft "not wired yet" cue — quieter than danger, still visible when outlines on.
  unwired: 'ring-2 ring-border-default/70 ring-offset-2 ring-offset-bg-canvas',
} as const;

const CONNECTIVITY_CODES = new Set([
  'validation-unreachable-node',
  'validation-non-terminable-node',
]);

/** Tailwind ring classes for a node's diagnostics, or '' when clean. */
export function validationRing(diagnostics: Diagnostic[] | undefined, unwired = false): string {
  if (!diagnostics || diagnostics.length === 0) return '';
  const shouting = unwired
    ? diagnostics.filter((d) => !CONNECTIVITY_CODES.has(d.code))
    : diagnostics;
  if (shouting.some((d) => d.severity === 'error')) return RING.error;
  if (shouting.some((d) => d.severity === 'warning')) return RING.warning;
  // Everything left is explained by the node not being wired yet — soften.
  if (shouting.length < diagnostics.length) return RING.unwired;
  return '';
}

/** Hover-tooltip text listing the reasons, or undefined when clean. */
export function validationTitle(diagnostics: Diagnostic[] | undefined): string | undefined {
  if (!diagnostics || diagnostics.length === 0) return undefined;
  return diagnostics.map((d) => `${SEVERITY_GLYPH[d.severity]} ${d.message}`).join('\n');
}

export function canvasNodeRing(diagnostics: Diagnostic[] | undefined, unwired?: boolean): string {
  return validationRing(diagnostics, unwired);
}

export function canvasNodeOpacity(): string {
  return '';
}

export function canvasNodeTitle(diagnostics: Diagnostic[] | undefined): string | undefined {
  return validationTitle(diagnostics);
}
