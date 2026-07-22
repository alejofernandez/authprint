'use client';

import type { ContextSlot } from '@authprint/dsl';
import { useTranslations } from 'next-intl';

const rowSelectCls =
  'w-full rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';

/** One typed `set:` patch input for a declared context slot. */
export function StepPatchRow({
  slot,
  declaration,
  value,
  onChange,
}: {
  slot: string;
  declaration: ContextSlot;
  value: unknown | undefined;
  onChange: (value: unknown | null) => void;
}) {
  const t = useTranslations('player.stepEditor.setPatch');
  const noneValue = '__none__';

  if (declaration.type === 'boolean') {
    const selected = value === true ? 'true' : value === false ? 'false' : noneValue;
    return (
      <label className="flex items-center justify-between gap-2" htmlFor={`set-${slot}`}>
        <span className="font-mono text-xs text-fg-muted">{slot}</span>
        <select
          id={`set-${slot}`}
          className={`${rowSelectCls} w-auto min-w-[88px]`}
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
      </label>
    );
  }

  if (declaration.type === 'enum') {
    const values = declaration.values ?? [];
    const selected = typeof value === 'string' && values.includes(value) ? value : noneValue;
    return (
      <label className="flex items-center justify-between gap-2" htmlFor={`set-${slot}`}>
        <span className="font-mono text-xs text-fg-muted">{slot}</span>
        <select
          id={`set-${slot}`}
          className={`${rowSelectCls} w-auto min-w-[88px]`}
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
      </label>
    );
  }

  if (declaration.type === 'number') {
    const display = value === undefined || value === null ? '' : String(value);
    return (
      <label className="flex items-center justify-between gap-2" htmlFor={`set-${slot}`}>
        <span className="font-mono text-xs text-fg-muted">{slot}</span>
        <input
          id={`set-${slot}`}
          type="number"
          className={`${rowSelectCls} w-auto min-w-[88px]`}
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
        />
      </label>
    );
  }

  const display = typeof value === 'string' ? value : '';
  return (
    <label className="flex items-center justify-between gap-2" htmlFor={`set-${slot}`}>
      <span className="font-mono text-xs text-fg-muted">{slot}</span>
      <input
        id={`set-${slot}`}
        type="text"
        className={`${rowSelectCls} w-auto min-w-[88px]`}
        value={display}
        placeholder={t('none')}
        onChange={(e) => {
          const raw = e.target.value;
          onChange(raw.trim().length === 0 ? null : raw);
        }}
      />
    </label>
  );
}
