'use client';

import type { ContextScalarValue, ContextSlot } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import type { ReactNode } from 'react';

const rowSelectCls =
  'w-full select-text rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';

/**
 * Label above, control below, control full width (UF-063).
 *
 * These rows were label-left / control-right, which cannot line up: a slot name
 * is a dotted path of unpredictable length, so every control started at a
 * different x and took a different width. Sizing the label column instead would
 * mean truncating identifiers, and the tail of `user_metadata.logins_count` is
 * the part that carries the meaning. Stacking is also what the `errorMessage`
 * field directly above these rows in the same panel already does.
 */
function PatchField({ slot, children }: { slot: string; children: ReactNode }) {
  return (
    <label className="block" htmlFor={`set-${slot}`}>
      <span className="mb-1 block break-all font-mono text-fg-muted text-xs">{slot}</span>
      {children}
    </label>
  );
}

/** One typed `set:` patch input for a declared context slot. */
export function StepPatchRow({
  slot,
  declaration,
  value,
  onChange,
}: {
  slot: string;
  declaration: ContextSlot;
  value: ContextScalarValue | undefined;
  onChange: (value: ContextScalarValue | null) => void;
}) {
  const t = useTranslations('player.stepEditor.setPatch');
  const noneValue = '__none__';

  if (declaration.type === 'boolean') {
    const selected = value === true ? 'true' : value === false ? 'false' : noneValue;
    return (
      <PatchField slot={slot}>
        <select
          id={`set-${slot}`}
          className={rowSelectCls}
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            if (v === noneValue) onChange(null);
            else onChange(v === 'true');
          }}
        >
          <option value={noneValue}>{t('none')}</option>
          <option value="true">true</option>
          <option value="false">false</option>
        </select>
      </PatchField>
    );
  }

  if (declaration.type === 'enum') {
    const values = declaration.values ?? [];
    const selected = typeof value === 'string' && values.includes(value) ? value : noneValue;
    return (
      <PatchField slot={slot}>
        <select
          id={`set-${slot}`}
          className={rowSelectCls}
          value={selected}
          onChange={(e) => {
            const v = e.target.value;
            onChange(v === noneValue ? null : v);
          }}
        >
          <option value={noneValue}>{t('none')}</option>
          {values.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </PatchField>
    );
  }

  if (declaration.type === 'number') {
    const display = value === undefined || value === null ? '' : String(value);
    return (
      <PatchField slot={slot}>
        <input
          id={`set-${slot}`}
          type="number"
          className={rowSelectCls}
          value={display}
          placeholder={t('none')}
          onChange={(e) => {
            const raw = e.target.value.trim();
            if (raw.length === 0) onChange(null);
            else {
              const n = Number(raw);
              onChange(Number.isNaN(n) ? null : n);
            }
          }}
          onKeyDown={(e) => {
            if (e.key !== 'Enter') return;
            e.preventDefault();
            e.stopPropagation();
            e.currentTarget.blur();
          }}
        />
      </PatchField>
    );
  }

  const display = typeof value === 'string' ? value : '';
  return (
    <PatchField slot={slot}>
      <input
        id={`set-${slot}`}
        type="text"
        className={rowSelectCls}
        value={display}
        placeholder={t('none')}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw.trim().length === 0 ? null : raw);
        }}
        onKeyDown={(e) => {
          if (e.key !== 'Enter') return;
          e.preventDefault();
          e.stopPropagation();
          e.currentTarget.blur();
        }}
      />
    </PatchField>
  );
}
