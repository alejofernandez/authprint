// Inline node editor (E26 / §7 surface #1, US-051): edit a node's properties in
// a card anchored to it on the canvas — name + kind for every type, plus a
// Screen's fidelity / traits / fields. Opened by double-clicking a node; writes
// through to the Y.Doc via the attribute ops. Decisions edit their predicate in
// a separate floating overlay (US-052), not here.

'use client';

import type { Node as DslNode, Field } from '@authprint/dsl';
import { FIDELITIES, TRAIT_IDS } from '@authprint/dsl';
import { useEffect, useRef } from 'react';

export type NodeEditActions = {
  setName: (id: string, name: string) => void;
  setKind: (id: string, kind: string) => void;
  setFidelity: (id: string, fidelity: 'lo-fi' | 'wireframe' | 'mockup') => void;
  setTraits: (id: string, traits: string[]) => void;
  setFields: (id: string, fields: Field[]) => void;
};

const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-zinc-400';
const inputCls =
  'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-indigo-400 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100';

export function NodeInlineEditor({
  node,
  at,
  actions,
  onClose,
}: {
  node: DslNode;
  at: { x: number; y: number }; // screen coords (top-left) to anchor the card
  actions: NodeEditActions;
  onClose: () => void;
}) {
  const ref = useRef<HTMLDivElement>(null);

  // Esc closes; click outside closes (commit-on-change means nothing is lost).
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const left = Math.min(at.x, window.innerWidth - 280);
  const top = Math.min(at.y, window.innerHeight - 320);
  const screen = node.type === 'screen' ? node : null;

  return (
    <div
      ref={ref}
      className="fixed z-50 w-64 space-y-3 rounded-lg border border-zinc-200 bg-white p-3 shadow-xl dark:border-zinc-700 dark:bg-zinc-900"
      style={{ left, top }}
    >
      {'name' in node && (
        <label className="block space-y-1">
          <span className={labelCls}>Name</span>
          <input
            className={inputCls}
            defaultValue={node.name ?? ''}
            // biome-ignore lint/a11y/noAutofocus: focusing the name on open is the point of double-click-to-edit
            autoFocus
            onBlur={(e) => actions.setName(node.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
      )}

      {'kind' in node && (
        <label className="block space-y-1">
          <span className={labelCls}>Kind</span>
          <input
            className={inputCls}
            defaultValue={node.kind}
            onBlur={(e) => actions.setKind(node.id, e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') e.currentTarget.blur();
            }}
          />
        </label>
      )}

      {screen && (
        <>
          <label className="block space-y-1">
            <span className={labelCls}>Fidelity</span>
            <select
              className={inputCls}
              defaultValue={screen.fidelity}
              onChange={(e) =>
                actions.setFidelity(node.id, e.target.value as 'lo-fi' | 'wireframe' | 'mockup')
              }
            >
              {FIDELITIES.map((f) => (
                <option key={f} value={f}>
                  {f}
                </option>
              ))}
            </select>
          </label>

          <div className="space-y-1">
            <span className={labelCls}>Traits</span>
            <div className="flex flex-wrap gap-1">
              {TRAIT_IDS.map((trait) => {
                const on = screen.traits.includes(trait);
                return (
                  <button
                    key={trait}
                    type="button"
                    onClick={() =>
                      actions.setTraits(
                        node.id,
                        on ? screen.traits.filter((t) => t !== trait) : [...screen.traits, trait],
                      )
                    }
                    className={`rounded-full border px-2 py-0.5 text-[11px] ${
                      on
                        ? 'border-indigo-400 bg-indigo-50 text-indigo-700 dark:bg-indigo-950/60 dark:text-indigo-200'
                        : 'border-zinc-300 text-zinc-500 dark:border-zinc-600 dark:text-zinc-400'
                    }`}
                  >
                    {trait}
                  </button>
                );
              })}
            </div>
          </div>

          <FieldsEditor
            fields={screen.fields}
            onChange={(fields) => actions.setFields(node.id, fields)}
          />
        </>
      )}
    </div>
  );
}

function FieldsEditor({
  fields,
  onChange,
}: {
  fields: Field[];
  onChange: (fields: Field[]) => void;
}) {
  const update = (i: number, patch: Partial<Field>) =>
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  return (
    <div className="space-y-1">
      <span className={labelCls}>Fields</span>
      {fields.map((field, i) => (
        // biome-ignore lint/suspicious/noArrayIndexKey: field rows are positional and edited in place
        <div key={i} className="flex items-center gap-1">
          <input
            className={`${inputCls} flex-1`}
            placeholder="name"
            defaultValue={field.name}
            onBlur={(e) => update(i, { name: e.target.value })}
          />
          <input
            className={`${inputCls} w-20`}
            placeholder="type"
            defaultValue={field.type}
            onBlur={(e) => update(i, { type: e.target.value })}
          />
          <input
            type="checkbox"
            aria-label="required"
            checked={field.required}
            onChange={(e) => update(i, { required: e.target.checked })}
          />
          <button
            type="button"
            aria-label="Remove field"
            className="px-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            onClick={() => onChange(fields.filter((_, j) => j !== i))}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        onClick={() => onChange([...fields, { name: '', type: 'custom', required: false }])}
      >
        + Add field
      </button>
    </div>
  );
}
