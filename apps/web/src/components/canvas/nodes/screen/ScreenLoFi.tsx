// Lo-fi screen tier (US-069) — a compact titled box listing field names as plain
// text. Structural preview without mockup chrome.

import type { ScreenNode } from '@authprint/dsl';
import { PlayerActionCallout } from './screenActionHighlight.tsx';
import { humanize } from './screenCopy.ts';

export function ScreenLoFi({
  node,
  highlightedAction = null,
  highlightedActionLabel = null,
}: {
  node: ScreenNode;
  highlightedAction?: string | null;
  highlightedActionLabel?: string | null;
}) {
  return (
    <div className="min-w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 shadow-sm flow-dark:border-zinc-700 flow-dark:bg-zinc-900">
      <div className="text-sm font-medium text-zinc-900 flow-dark:text-zinc-100">{node.name}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500 flow-dark:text-zinc-400">
        {node.kind}
      </div>
      {node.fields.length > 0 ? (
        <ul className="mt-2 space-y-0.5 font-mono text-[11px] text-zinc-600 flow-dark:text-zinc-400">
          {node.fields.map((field) => (
            <li key={field.name}>{humanize(field.name)}</li>
          ))}
        </ul>
      ) : null}
      {highlightedAction ? (
        <div className="mt-2">
          <PlayerActionCallout action={highlightedAction} exitLabel={highlightedActionLabel} />
        </div>
      ) : null}
    </div>
  );
}
