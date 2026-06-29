// Node inspector form body (E26 / §7, US-051 + US-052): property fields rendered
// inside NodeInspector's scrollable shell. Writes through to the Y.Doc via
// attribute ops.

'use client';

import type {
  Context,
  ContextSlot,
  Node as DslNode,
  Field,
  Predicate,
  PredicateOp,
  SlotType,
} from '@authprint/dsl';
import {
  ACTION_KINDS_BUILTIN,
  DECISION_KINDS_BUILTIN,
  EXTERNAL_KINDS_BUILTIN,
  FIDELITIES,
  FIELD_TYPES_BUILTIN,
  OUTCOME_KINDS_BUILTIN,
  PREDICATE_OPS,
  SCREEN_KINDS_BUILTIN,
  SLOT_TYPES,
  TRAIT_IDS,
} from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useState } from 'react';

export type NodeEditActions = {
  setName: (id: string, name: string) => void;
  setKind: (id: string, kind: string) => void;
  setFidelity: (id: string, fidelity: 'lo-fi' | 'wireframe' | 'mockup') => void;
  setTraits: (id: string, traits: string[]) => void;
  setFields: (id: string, fields: Field[]) => void;
  setPredicate: (id: string, predicate: Predicate) => void;
  declareSlot: (name: string, slot: ContextSlot) => void;
};

const OPS_FOR_TYPE: Record<SlotType, readonly PredicateOp[]> = {
  boolean: ['equals', 'not-equals'],
  string: ['equals', 'not-equals', 'in', 'not-in'],
  enum: ['equals', 'not-equals', 'in', 'not-in'],
  number: PREDICATE_OPS,
};

function defaultValueFor(slot: ContextSlot | undefined): unknown {
  switch (slot?.type) {
    case 'boolean':
      return true;
    case 'number':
      return 0;
    case 'enum':
      return slot.values?.[0] ?? '';
    default:
      return '';
  }
}

const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-zinc-400';
const inputCls =
  'w-full rounded border border-zinc-300 bg-white px-2 py-1 text-sm text-zinc-900 outline-none focus:border-indigo-400 focus-visible:ring-2 focus-visible:ring-indigo-400 focus-visible:ring-offset-1 dark:border-zinc-600 dark:bg-zinc-800 dark:text-zinc-100 dark:focus-visible:ring-offset-zinc-900';

const KIND_OPTIONS = {
  screen: SCREEN_KINDS_BUILTIN,
  decision: DECISION_KINDS_BUILTIN,
  action: ACTION_KINDS_BUILTIN,
  external: EXTERNAL_KINDS_BUILTIN,
  outcome: OUTCOME_KINDS_BUILTIN,
} as const;

type KindNodeType = keyof typeof KIND_OPTIONS;

function KindSelect({
  id,
  nodeType,
  value,
  onChange,
}: {
  id: string;
  nodeType: KindNodeType;
  value: string;
  onChange: (kind: string) => void;
}) {
  const t = useTranslations('inspector.kind');
  const options = KIND_OPTIONS[nodeType];
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="space-y-1">
        <input
          id={id}
          className={inputCls}
          defaultValue={value}
          onBlur={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          onClick={() => setCustom(false)}
        >
          {t('chooseFromList')}
        </button>
      </div>
    );
  }

  const inList = (options as readonly string[]).includes(value);
  return (
    <select
      id={id}
      className={inputCls}
      value={inList ? value : '__current__'}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setCustom(true);
          return;
        }
        if (e.target.value !== '__current__') onChange(e.target.value);
      }}
    >
      {!inList && <option value="__current__">{t('customValue', { value })}</option>}
      {options.map((k) => (
        <option key={k} value={k}>
          {k}
        </option>
      ))}
      <option value="__custom__">{t('customOption')}</option>
    </select>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="space-y-2">
      <h3 className={labelCls}>{title}</h3>
      <div className="space-y-2">{children}</div>
    </section>
  );
}

export function NodeInlineEditor({
  node,
  context,
  actions,
}: {
  node: DslNode;
  context: Context;
  actions: NodeEditActions;
}) {
  const t = useTranslations('inspector');
  const screen = node.type === 'screen' ? node : null;
  const decision = node.type === 'decision' ? node : null;

  return (
    <div className="space-y-4">
      <Section title={t('sections.general')}>
        {'name' in node && (
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('labels.name')}</span>
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

        {'kind' in node && node.type in KIND_OPTIONS && (
          <label className="block space-y-1" htmlFor={`kind-${node.id}`}>
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('labels.kind')}</span>
            <KindSelect
              id={`kind-${node.id}`}
              key={node.id}
              nodeType={node.type as KindNodeType}
              value={node.kind}
              onChange={(kind) => actions.setKind(node.id, kind)}
            />
          </label>
        )}

        {screen && (
          <label className="block space-y-1">
            <span className="text-xs text-zinc-500 dark:text-zinc-400">{t('labels.fidelity')}</span>
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
        )}
      </Section>

      {screen && (
        <Section title={t('sections.traits')}>
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
        </Section>
      )}

      {screen && (
        <Section title={t('sections.fields')}>
          <FieldsEditor
            key={node.id}
            fields={screen.fields}
            onChange={(fields) => actions.setFields(node.id, fields)}
          />
        </Section>
      )}

      {decision && (
        <Section title={t('sections.predicate')}>
          <PredicateEditor
            predicate={decision.predicate}
            context={context}
            onChange={(p) => actions.setPredicate(node.id, p)}
            onDeclareSlot={actions.declareSlot}
          />
        </Section>
      )}
    </div>
  );
}

function PredicateEditor({
  predicate,
  context,
  onChange,
  onDeclareSlot,
}: {
  predicate: Predicate;
  context: Context;
  onChange: (p: Predicate) => void;
  onDeclareSlot: (name: string, slot: ContextSlot) => void;
}) {
  const t = useTranslations('inspector');
  const [addingSlot, setAddingSlot] = useState(false);
  const slotNames = Object.keys(context);
  const slot = context[predicate.slot];
  const declared = predicate.slot in context;
  const update = (patch: Partial<Predicate>) => onChange({ ...predicate, ...patch });

  return (
    <div className="space-y-2">
      <select
        className={inputCls}
        value={predicate.slot}
        onChange={(e) => {
          if (e.target.value === '__new__') {
            setAddingSlot(true);
            return;
          }
          const next = context[e.target.value];
          update({ slot: e.target.value, op: 'equals', value: defaultValueFor(next) });
        }}
      >
        {!declared && (
          <option value={predicate.slot}>
            {t('predicate.undeclaredSlot', { slot: predicate.slot })}
          </option>
        )}
        {slotNames.map((n) => (
          <option key={n} value={n}>
            {n}
          </option>
        ))}
        <option value="__new__">{t('predicate.newSlot')}</option>
      </select>

      {addingSlot && (
        <NewSlotForm
          onAdd={(name, newSlot) => {
            onDeclareSlot(name, newSlot);
            update({ slot: name, op: 'equals', value: defaultValueFor(newSlot) });
            setAddingSlot(false);
          }}
          onCancel={() => setAddingSlot(false)}
        />
      )}

      <select
        className={inputCls}
        value={predicate.op}
        onChange={(e) => update({ op: e.target.value as PredicateOp })}
      >
        {(slot ? OPS_FOR_TYPE[slot.type] : PREDICATE_OPS).map((op) => (
          <option key={op} value={op}>
            {op}
          </option>
        ))}
      </select>

      <ValueInput slot={slot} value={predicate.value} onChange={(value) => update({ value })} />
    </div>
  );
}

function ValueInput({
  slot,
  value,
  onChange,
}: {
  slot: ContextSlot | undefined;
  value: unknown;
  onChange: (value: unknown) => void;
}) {
  const t = useTranslations('inspector.value');
  if (slot?.type === 'boolean') {
    return (
      <select
        className={inputCls}
        value={String(value)}
        onChange={(e) => onChange(e.target.value === 'true')}
      >
        <option value="true">{t('true')}</option>
        <option value="false">{t('false')}</option>
      </select>
    );
  }
  if (slot?.type === 'number') {
    return (
      <input
        type="number"
        className={inputCls}
        defaultValue={typeof value === 'number' ? value : 0}
        onBlur={(e) => onChange(e.target.valueAsNumber)}
      />
    );
  }
  if (slot?.type === 'enum') {
    return (
      <select className={inputCls} value={String(value)} onChange={(e) => onChange(e.target.value)}>
        {(slot.values ?? []).map((v) => (
          <option key={v} value={v}>
            {v}
          </option>
        ))}
      </select>
    );
  }
  return (
    <input
      className={inputCls}
      placeholder={t('placeholder')}
      defaultValue={typeof value === 'string' ? value : String(value ?? '')}
      onBlur={(e) => onChange(e.target.value)}
    />
  );
}

function NewSlotForm({
  onAdd,
  onCancel,
}: {
  onAdd: (name: string, slot: ContextSlot) => void;
  onCancel: () => void;
}) {
  const t = useTranslations('inspector.slot');
  const [name, setName] = useState('');
  const [type, setType] = useState<SlotType>('boolean');
  const [values, setValues] = useState('');

  return (
    <div className="space-y-1 rounded border border-zinc-200 p-2 dark:border-zinc-700">
      <input
        className={inputCls}
        placeholder={t('namePlaceholder')}
        value={name}
        onChange={(e) => setName(e.target.value)}
      />
      <select
        className={inputCls}
        value={type}
        onChange={(e) => setType(e.target.value as SlotType)}
      >
        {SLOT_TYPES.map((t) => (
          <option key={t} value={t}>
            {t}
          </option>
        ))}
      </select>
      {type === 'enum' && (
        <input
          className={inputCls}
          placeholder={t('enumValuesPlaceholder')}
          value={values}
          onChange={(e) => setValues(e.target.value)}
        />
      )}
      <div className="flex gap-2">
        <button
          type="button"
          disabled={name.trim().length === 0}
          className="rounded bg-indigo-600 px-2 py-1 text-white text-xs disabled:opacity-50"
          onClick={() => {
            const enumValues = values
              .split(',')
              .map((v) => v.trim())
              .filter(Boolean);
            onAdd(name.trim(), type === 'enum' ? { type, values: enumValues } : { type });
          }}
        >
          {t('add')}
        </button>
        <button type="button" className="px-2 py-1 text-xs text-zinc-500" onClick={onCancel}>
          {t('cancel')}
        </button>
      </div>
    </div>
  );
}

function FieldTypeSelect({
  id,
  value,
  onChange,
}: {
  id: string;
  value: string;
  onChange: (type: string) => void;
}) {
  const options = FIELD_TYPES_BUILTIN;
  const [custom, setCustom] = useState(false);

  if (custom) {
    return (
      <div className="space-y-1">
        <input
          id={id}
          className={inputCls}
          defaultValue={value}
          onBlur={(e) => onChange(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
        />
        <button
          type="button"
          className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
          onClick={() => setCustom(false)}
        >
          Choose from list
        </button>
      </div>
    );
  }

  const inList = (options as readonly string[]).includes(value);
  return (
    <select
      id={id}
      className={inputCls}
      value={inList ? value : '__current__'}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setCustom(true);
          return;
        }
        if (e.target.value !== '__current__') onChange(e.target.value);
      }}
    >
      {!inList && (
        <option value="__current__">
          {value === 'custom' ? 'Choose type…' : `${value} (custom)`}
        </option>
      )}
      {options.map((t) => (
        <option key={t} value={t}>
          {t}
        </option>
      ))}
      <option value="__custom__">Custom…</option>
    </select>
  );
}

function FieldsEditor({
  fields,
  onChange,
}: {
  fields: Field[];
  onChange: (fields: Field[]) => void;
}) {
  const [rowKeys, setRowKeys] = useState(() => fields.map(() => crypto.randomUUID()));
  const t = useTranslations('inspector.fields');
  const update = (i: number, patch: Partial<Field>) =>
    onChange(fields.map((f, j) => (j === i ? { ...f, ...patch } : f)));

  const move = (from: number, to: number) => {
    if (to < 0 || to >= fields.length) return;
    const next = [...fields];
    const item = next.splice(from, 1)[0];
    if (!item) return;
    next.splice(to, 0, item);
    setRowKeys((keys) => {
      const nextKeys = [...keys];
      const key = nextKeys.splice(from, 1)[0];
      if (!key) return keys;
      nextKeys.splice(to, 0, key);
      return nextKeys;
    });
    onChange(next);
  };

  const remove = (i: number) => {
    setRowKeys((keys) => keys.filter((_, j) => j !== i));
    onChange(fields.filter((_, j) => j !== i));
  };

  const add = () => {
    setRowKeys((keys) => [...keys, crypto.randomUUID()]);
    onChange([...fields, { name: '', type: 'text', required: false }]);
  };

  return (
    <div className="space-y-1">
      {fields.map((field, i) => (
        <div key={rowKeys[i]} className="flex items-center gap-1">
          <div className="flex shrink-0 flex-col gap-0.5">
            <button
              type="button"
              aria-label="Move field up"
              disabled={i === 0}
              className="px-0.5 text-[10px] leading-none text-zinc-400 hover:text-zinc-600 disabled:opacity-30 dark:hover:text-zinc-200"
              onClick={() => move(i, i - 1)}
            >
              ↑
            </button>
            <button
              type="button"
              aria-label="Move field down"
              disabled={i === fields.length - 1}
              className="px-0.5 text-[10px] leading-none text-zinc-400 hover:text-zinc-600 disabled:opacity-30 dark:hover:text-zinc-200"
              onClick={() => move(i, i + 1)}
            >
              ↓
            </button>
          </div>
          <input
            className={`${inputCls} min-w-0 flex-1`}
            placeholder={t('namePlaceholder')}
            defaultValue={field.name}
            onBlur={(e) => update(i, { name: e.target.value })}
          />
          <div className="w-28 shrink-0">
            <FieldTypeSelect
              id={`field-type-${rowKeys[i]}`}
              value={field.type}
              onChange={(type) => update(i, { type })}
            />
          </div>
          <input
            type="checkbox"
            aria-label={t('required')}
            checked={field.required}
            onChange={(e) => update(i, { required: e.target.checked })}
          />
          <button
            type="button"
            aria-label={t('remove')}
            className="px-1 text-zinc-400 hover:text-zinc-600 dark:hover:text-zinc-200"
            onClick={() => remove(i)}
          >
            ✕
          </button>
        </div>
      ))}
      <button
        type="button"
        className="text-xs text-indigo-600 hover:underline dark:text-indigo-400"
        onClick={add}
      >
        {t('add')}
      </button>
    </div>
  );
}
