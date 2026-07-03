// Problems disclosure (E33 / US-058): a small corner badge with the live
// error/warning counts; click to expand a dockable, dismissable list of all
// diagnostics. Clicking a diagnostic that targets a node/edge centers it on the
// canvas. Transient and opt-in — never a permanent side panel (a deliberate product anti-pattern).

'use client';

import type { Diagnostic } from '@authprint/dsl';
import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
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
  const { errorCount, warningCount, diagnostics } = validation;
  const { getNode, setCenter } = useReactFlow();

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
    <div className="relative">
      {open && total > 0 && (
        <div className="absolute right-0 bottom-full z-10 mb-1 max-h-72 w-80 overflow-auto rounded-lg border border-border-subtle bg-bg-panel p-1 shadow-xl dark:border-border-default">
          {diagnostics.map((d, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics are a stable derived list for this render
              key={i}
              type="button"
              disabled={d.target?.kind !== 'node'}
              onClick={() => focus(d)}
              className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${
                d.target?.kind === 'node'
                  ? 'cursor-pointer hover:bg-bg-canvas dark:hover:bg-bg-subtle'
                  : 'cursor-default'
              }`}
            >
              <span className="mt-px shrink-0">{d.severity === 'error' ? '⛔' : '⚠️'}</span>
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
          onClick={() => total > 0 && setOpen((o) => !o)}
          className="flex items-center gap-2 px-2.5 py-1.5 text-sm"
          aria-expanded={open}
        >
          {total === 0 ? (
            <span>✓ Valid</span>
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
              <span className="text-fg-subtle text-xs">Problems</span>
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
            className={`border-border-default border-l px-2 py-1.5 text-sm dark:border-border-default ${
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
