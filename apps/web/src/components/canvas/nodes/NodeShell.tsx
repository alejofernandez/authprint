// Shared shell for node card content. Each per-structural-type component
// composes around this — distinct shape/color via outer wrapper, common
// label + id/kind layout inside.

import type { ReactNode } from 'react';

export type NodeShellProps = {
  /** Structural type label shown subtly above the name. */
  typeLabel: string;
  /** Display name; falls back to id when absent. */
  name?: string;
  /** Node id — always present, shown small + monospace as a secondary label. */
  id: string;
  /** Kind string (e.g., 'password') — shown when present. Entry has none. */
  kind?: string;
  /** Outer wrapper element/className supplied by the per-type component. */
  children?: ReactNode;
};

export function NodeShellContent({ typeLabel, name, id, kind }: NodeShellProps) {
  return (
    <div className="px-3 py-2 min-w-44">
      <div className="text-[10px] uppercase tracking-wider font-medium text-fg-subtle">
        {typeLabel}
      </div>
      <div className="mt-0.5 text-sm font-medium text-fg-default truncate">{name ?? id}</div>
      {kind ? (
        <div className="mt-1 text-[11px] text-fg-muted dark:text-fg-subtle font-mono truncate">
          {kind}
        </div>
      ) : (
        <div className="mt-1 text-[11px] text-fg-subtle font-mono truncate">{id}</div>
      )}
    </div>
  );
}
