// Shared validation presentation for node components (E33 / US-057). A node
// flagged by `validate()` gets a ring (red error / amber warning — warm = state
// signal per the aesthetic) and a `title` tooltip listing the reasons. Error
// beats warning when both apply. US-061 adds trace-aware helpers that take
// precedence when scenario mode is active.

import type { Diagnostic } from '@authprint/dsl';
import type { TraceNodeState } from '../scenario/scenarioTrace.ts';
import { traceOpacity, traceRing } from '../scenario/scenarioTrace.ts';

const RING = {
  error: 'ring-2 ring-signal-danger-ring ring-offset-2 ring-offset-bg-canvas',
  warning: 'ring-2 ring-signal-warning-ring ring-offset-2 ring-offset-bg-canvas',
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

/** Node ring: trace styling wins in scenario mode; else validation (E33). */
export function canvasNodeRing(
  diagnostics: Diagnostic[] | undefined,
  traceState?: TraceNodeState,
): string {
  const trace = traceRing(traceState);
  if (trace) return trace;
  return validationRing(diagnostics);
}

/** Node opacity for visited trace steps (US-061). */
export function canvasNodeOpacity(traceState?: TraceNodeState): string {
  return traceOpacity(traceState);
}

/** Hover title: divergence reason, else validation messages. */
export function canvasNodeTitle(
  diagnostics: Diagnostic[] | undefined,
  traceTooltip?: string,
): string | undefined {
  if (traceTooltip) return traceTooltip;
  return validationTitle(diagnostics);
}
