'use client';

import type { ContextSlot } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import {
  placeFloatingPanelAbove,
  placeFloatingPanelBelow,
  type ScreenRect,
} from '../floatingPanelPlacement.ts';
import type { StepEditorPopoverProps } from './stepEditorTypes.ts';
import type { PlayerStep } from './steps.ts';

const PANEL_WIDTH = 280;
/** Matches globals.css --duration-base (200ms). */
const MOTION_DURATION_BASE_MS = 200;

const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-fg-subtle';
const rowSelectCls =
  'w-full rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';

function panelPosition(anchor: ScreenRect, height: number): { left: number; top: number } {
  const panel = { width: PANEL_WIDTH, height };
  const below = placeFloatingPanelBelow(anchor, panel);
  const viewport = {
    width: typeof window !== 'undefined' ? window.innerWidth : 1200,
    height: typeof window !== 'undefined' ? window.innerHeight : 800,
  };
  if (below.top + height <= viewport.height - 12) return below;
  return placeFloatingPanelAbove(anchor, panel);
}

function ContextPatchRow({
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

function DerivedStepBody({ step }: { step: PlayerStep }) {
  const t = useTranslations('player.stepEditor.derived');

  let explanation: string;
  switch (step.nodeType) {
    case 'decision':
      explanation = t('decision');
      break;
    case 'outcome':
      explanation = t('outcome');
      break;
    case 'entry':
      explanation = t('entry');
      break;
    default:
      explanation = t('generic');
  }

  return (
    <>
      <p className={labelCls}>
        {step.nodeType} · {t('badge')}
      </p>
      <p className="text-sm font-medium text-fg-default">{step.displayName}</p>
      <p className="text-xs leading-relaxed text-fg-muted">{explanation}</p>
      {step.nodeType === 'decision' && step.decisionQuestion ? (
        <p className="mt-2 text-xs text-fg-subtle">{step.decisionQuestion}</p>
      ) : null}
    </>
  );
}

function ScriptedStepBody({
  editable,
  contextSlots,
  onActionChange,
  onResultChange,
  onSetPatchChange,
  onDeleteFromHere,
}: Pick<
  StepEditorPopoverProps,
  'contextSlots' | 'onActionChange' | 'onResultChange' | 'onSetPatchChange' | 'onDeleteFromHere'
> & {
  editable: Extract<StepEditorPopoverProps, { variant: 'scripted' }>['editable'];
}) {
  const t = useTranslations('player.stepEditor');
  const setPatch = editable.step.set ?? {};
  const slotNames = Object.keys(contextSlots);

  const choiceLabel =
    editable.kind === 'screen' ? t('scripted.actionLabel') : t('scripted.resultLabel');
  const choiceValue = editable.kind === 'screen' ? editable.step.action : editable.step.result;
  const choices =
    editable.kind === 'screen'
      ? editable.legalActions
      : editable.kind === 'action'
        ? editable.legalResults
        : editable.legalResults;

  const rerouteTarget =
    editable.kind === 'screen' ? t('scripted.rerouteAction') : t('scripted.rerouteResult');

  return (
    <>
      <p className={labelCls}>
        {editable.kind === 'screen' ? t('scripted.screenKind') : t('scripted.actionKind')} ·{' '}
        {t('scripted.badge')}
      </p>
      <p className="text-sm font-medium text-fg-default">{editable.displayName}</p>

      <label className="mt-3 block space-y-1" htmlFor="step-editor-choice">
        <span className={labelCls}>{choiceLabel}</span>
        <select
          id="step-editor-choice"
          className={rowSelectCls}
          value={choiceValue}
          onChange={(e) => {
            if (editable.kind === 'screen') onActionChange?.(e.target.value);
            else onResultChange?.(e.target.value);
          }}
        >
          {choices.map((choice) => (
            <option key={choice} value={choice}>
              {choice}
            </option>
          ))}
        </select>
      </label>

      {slotNames.length > 0 ? (
        <div className="mt-3 space-y-2">
          <p className={labelCls}>{t('setPatch.title')}</p>
          {slotNames.map((slot) => (
            <ContextPatchRow
              key={slot}
              slot={slot}
              declaration={contextSlots[slot] ?? { type: 'string' }}
              value={setPatch[slot]}
              onChange={(value) => onSetPatchChange?.(slot, value)}
            />
          ))}
        </div>
      ) : null}

      <p className="mt-3 text-xs leading-relaxed text-signal-warning-fg">
        {t('scripted.rerouteWarning', { target: rerouteTarget })}
      </p>

      <button
        type="button"
        className="mt-3 w-full rounded border border-signal-danger-ring bg-signal-error-bg px-2 py-1.5 text-sm font-medium text-signal-error-label hover:bg-signal-error-bg-muted dark:border-signal-danger dark:bg-signal-error-bg-muted dark:text-signal-error-fg dark:hover:bg-signal-error-bg"
        onClick={() => onDeleteFromHere?.()}
      >
        {t('scripted.deleteFromHere')}
      </button>
    </>
  );
}

export function StepEditorPopover(props: StepEditorPopoverProps) {
  const t = useTranslations('player.stepEditor');
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(200);
  const [shown, setShown] = useState(false);
  const closingRef = useRef(false);

  const closeAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    window.setTimeout(props.onClose, MOTION_DURATION_BASE_MS);
  }, [props.onClose]);

  const closeHandlerRef = useRef(closeAnimated);

  useLayoutEffect(() => {
    closeHandlerRef.current = closeAnimated;
  }, [closeAnimated]);

  useLayoutEffect(() => {
    const frame = requestAnimationFrame(() => setShown(true));
    return () => cancelAnimationFrame(frame);
  }, []);

  useLayoutEffect(() => {
    const el = panelRef.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height;
      if (h) setPanelHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeHandlerRef.current();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        closeHandlerRef.current();
      }
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, []);

  const position = panelPosition(props.anchor, panelHeight);

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="step-editor-title"
      className={`fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-panel shadow-2xl transition-[opacity,transform] duration-[var(--duration-base)] ease-standard dark:border-border-default ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
      style={{
        left: position.left,
        top: position.top,
        width: PANEL_WIDTH,
      }}
    >
      <div className="flex items-center gap-1.5 border-border-subtle border-b px-2.5 py-1 dark:border-border-default">
        <span id="step-editor-title" className="min-w-0 flex-1 text-sm font-medium text-fg-default">
          {t('title')}
        </span>
        <button
          type="button"
          aria-label={t('close')}
          className="shrink-0 rounded p-0.5 text-fg-subtle outline-none hover:bg-bg-subtle hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent-primary-border dark:hover:bg-bg-subtle dark:hover:text-fg-soft"
          onClick={() => closeHandlerRef.current()}
        >
          ✕
        </button>
      </div>
      <div className="space-y-1 p-3">
        {props.variant === 'derived' ? (
          <DerivedStepBody step={props.step} />
        ) : (
          <ScriptedStepBody
            editable={props.editable}
            contextSlots={props.contextSlots}
            onActionChange={props.onActionChange}
            onResultChange={props.onResultChange}
            onSetPatchChange={props.onSetPatchChange}
            onDeleteFromHere={props.onDeleteFromHere}
          />
        )}
      </div>
    </div>
  );
}
