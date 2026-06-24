// Problems disclosure (E33 / US-058): a small corner badge with the live
// error/warning counts; click to expand a dockable, dismissable list of all
// diagnostics. Clicking a diagnostic that targets a node/edge centers it on the
// canvas. Transient and opt-in — never a permanent side panel (§7).

'use client';

import type { Diagnostic } from '@authprint/dsl';
import { useReactFlow } from '@xyflow/react';
import { useState } from 'react';
import type { ValidationResult } from './useValidation.ts';

export function ProblemsPanel({ validation }: { validation: ValidationResult }) {
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
    <div className="absolute top-4 right-4 z-20 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={() => total > 0 && setOpen((o) => !o)}
        className={`flex items-center gap-2 rounded-md border px-2.5 py-1.5 text-sm shadow-sm backdrop-blur ${
          total === 0
            ? 'cursor-default border-emerald-300 bg-emerald-50/80 text-emerald-700 dark:border-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
            : 'border-zinc-300 bg-white/80 text-zinc-700 dark:border-zinc-700 dark:bg-zinc-900/80 dark:text-zinc-200'
        }`}
        aria-expanded={open}
      >
        {total === 0 ? (
          <span>✓ Valid</span>
        ) : (
          <>
            {errorCount > 0 && (
              <span className="text-red-600 dark:text-red-400">⛔ {errorCount}</span>
            )}
            {warningCount > 0 && (
              <span className="text-amber-600 dark:text-amber-400">⚠️ {warningCount}</span>
            )}
            <span className="text-zinc-400 text-xs">Problems</span>
          </>
        )}
      </button>

      {open && total > 0 && (
        <div className="max-h-72 w-80 overflow-auto rounded-lg border border-zinc-200 bg-white p-1 shadow-xl dark:border-zinc-700 dark:bg-zinc-900">
          {diagnostics.map((d, i) => (
            <button
              // biome-ignore lint/suspicious/noArrayIndexKey: diagnostics are a stable derived list for this render
              key={i}
              type="button"
              disabled={d.target?.kind !== 'node'}
              onClick={() => focus(d)}
              className={`flex w-full items-start gap-2 rounded px-2 py-1.5 text-left text-xs ${
                d.target?.kind === 'node'
                  ? 'cursor-pointer hover:bg-zinc-50 dark:hover:bg-zinc-800'
                  : 'cursor-default'
              }`}
            >
              <span className="mt-px shrink-0">{d.severity === 'error' ? '⛔' : '⚠️'}</span>
              <span className="text-zinc-700 dark:text-zinc-300">{d.message}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
