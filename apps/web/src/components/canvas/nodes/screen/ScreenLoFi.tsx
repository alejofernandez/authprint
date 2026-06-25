// Lo-fi screen tier (US-069) — a compact titled box listing field names as plain
// text. Structural preview without mockup chrome.

import type { ScreenNode } from '@authprint/dsl';
import { humanize } from './screenCopy.ts';

export function ScreenLoFi({ node }: { node: ScreenNode }) {
  return (
    <div className="min-w-44 rounded-lg border border-zinc-300 bg-white px-3 py-2.5 shadow-sm dark:border-zinc-700 dark:bg-zinc-900">
      <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">{node.name}</div>
      <div className="mt-0.5 truncate font-mono text-[10px] text-zinc-500 dark:text-zinc-400">
        {node.kind}
      </div>
      {node.fields.length > 0 ? (
        <ul className="mt-2 space-y-0.5 text-[11px] text-zinc-600 dark:text-zinc-400">
          {node.fields.map((field) => (
            <li key={field.name}>{humanize(field.name)}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
