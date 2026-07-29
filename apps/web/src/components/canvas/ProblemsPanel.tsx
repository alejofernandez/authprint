// Problems disclosure (E33 / US-058): a small badge with the live error/warning
// counts; click to expand a dismissable list of all diagnostics. Clicking a
// diagnostic that targets a node/edge centers it on the canvas. Lives in the
// toolbar (US-132); the list opens downward.

'use client';

import type { Diagnostic } from '@authprint/dsl';
import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import { SEVERITY_GLYPH } from './nodes/nodeValidation.ts';
import type { ValidationResult } from './useValidation.ts';

export function ProblemsPanel({
  validation,
  showOutlines,
  onToggleOutlines,
}: {
  validation: ValidationResult;
  showOutlines: boolean;
  onToggleOutlines: () => void;
}) {
  const [open, setOpen] = useState(false);
  const { errorCount, warningCount, infoCount, diagnostics } = validation;
  const { getNode, setCenter } = useReactFlow();

  // `info` is deliberately absent from `total`: the pill stays in its clean
  // state for a flow whose only diagnostics are accepted custom values. The
  // list still opens on `diagnostics.length`, so they remain discoverable
  // rather than merely silenced (US-043).
  const total = errorCount + warningCount;

  const focus = (d: Diagnostic) => {
    if (d.target?.kind !== 'node') return; // edges focus via their nodes later; flow-level: nothing
    const node = getNode(d.target.id);
    if (!node) return;
    const w = node.measured?.width ?? 0;
    const h = node.measured?.height ?? 0;
    setCenter(node.position.x + w / 2, node.position.y + h / 2, { zoom: 1.2, duration: 300 });
  };

  return (
    <div className="relative shrink-0">
      {open && diagnostics.length > 0 && (
        <div className="absolute top-full right-0 z-50 mt-1 max-h-72 w-80 overflow-auto rounded-lg border border-border-subtle bg-bg-panel p-1 shadow-xl dark:border-border-default">
          {diagnostics.map((d, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics are a stable derived list for this render
              key={i}
              type="button"
              disabled={d.target?.kind !== 'node'}
              onClick={() => focus(d)}
              className={`flex min-h-6 w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${
                d.target?.kind === 'node'
                  ? 'cursor-pointer hover:bg-bg-canvas dark:hover:bg-bg-subtle'
                  : 'cursor-default'
              }`}
            >
              <span className="mt-px shrink-0">{SEVERITY_GLYPH[d.severity]}</span>
              <span className="text-fg-secondary dark:text-fg-muted">{d.message}</span>
            </button>
          ))}
        </div>
      )}

      <div
        className={`flex items-center rounded-md border shadow-sm ${
          total === 0
            ? 'border-node-outcome-success-border bg-node-outcome-success-bg text-node-outcome-success-fg dark:border-node-outcome-success-border dark:bg-node-outcome-success-bg dark:text-node-outcome-success-fg'
            : 'border-border-default bg-bg-subtle/80 text-fg-secondary dark:border-border-default dark:bg-bg-subtle/80 dark:text-fg-soft'
        }`}
      >
        <button
          type="button"
          onClick={() => diagnostics.length > 0 && setOpen((o) => !o)}
          className="flex min-h-6 items-center gap-2 px-2.5 py-1 text-sm"
          aria-expanded={open}
        >
          {total === 0 ? (
            <>
              <span>✓ Valid</span>
              {/* Keeps the clean (green) state — an accepted custom value is not
                  a problem — while still offering a way in to read it. */}
              {infoCount > 0 && <span className="text-xs opacity-70">ℹ️ {infoCount}</span>}
            </>
          ) : (
            <>
              {errorCount > 0 && (
                <span className="text-signal-danger dark:text-signal-danger-fg">
                  ⛔ {errorCount}
                </span>
              )}
              {warningCount > 0 && (
                <span className="text-signal-warning dark:text-signal-warning-fg">
                  ⚠️ {warningCount}
                </span>
              )}
              <span className="hidden text-fg-subtle text-xs min-[420px]:inline">Problems</span>
            </>
          )}
        </button>
        {total > 0 && (
          <button
            type="button"
            onClick={onToggleOutlines}
            aria-pressed={showOutlines}
            title={
              showOutlines
                ? 'Hide validation outlines on the canvas'
                : 'Show validation outlines on the canvas'
            }
            className={`min-h-6 border-border-default border-l px-2 py-1 text-sm dark:border-border-default ${
              showOutlines
                ? 'text-accent-primary-solid dark:text-accent-primary'
                : 'text-fg-subtle line-through'
            }`}
          >
            👁
          </button>
        )}
      </div>
    </div>
  );
}
