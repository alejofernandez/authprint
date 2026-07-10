// Edge trigger editor (US-114): double-click an edge → small anchored overlay.
// Closed pairs swap atomically; screen interactions pick from the vocabulary.

'use client';

import type { Flow, Trigger } from '@authprint/dsl';
import { USER_ACTIONS_BUILTIN } from '@authprint/dsl';
import { useTranslations } from 'next-intl';
import { useCallback, useLayoutEffect, useRef, useState } from 'react';
import { findSwappableSiblingEdge, usedScreenInteractionActions } from './edgeTriggerUtils.ts';
import { placeFloatingPanelAtPoint } from './floatingPanelPlacement.ts';
import { labelFor } from './flowToReactFlow.ts';

const PANEL_WIDTH = 280;
/** Matches globals.css --duration-base (200ms). */
const MOTION_DURATION_BASE_MS = 200;

const labelCls = 'text-[10px] font-medium uppercase tracking-wider text-fg-subtle';
const inputCls =
  'w-full rounded border border-border-default bg-bg-panel px-2 py-1 text-sm text-fg-default outline-none focus:border-accent-primary-border focus-visible:ring-2 focus-visible:ring-accent-primary-border focus-visible:ring-offset-1 dark:focus-visible:ring-offset-bg-panel';
const identifierInputCls = `${inputCls} font-mono`;

export type EdgeTriggerActions = {
  setTrigger: (edgeId: string, trigger: Trigger) => void;
  swapWithSibling: (edgeId: string, siblingId: string) => void;
};

function InteractionActionSelect({
  id,
  value,
  disabledActions,
  onPick,
  onCustomDraftChange,
}: {
  id: string;
  value: string;
  disabledActions: ReadonlySet<string>;
  /** Builtin list pick — commit immediately (parent closes the editor). */
  onPick: (action: string) => void;
  /** Custom text field — parent commits on dismiss. */
  onCustomDraftChange: (action: string) => void;
}) {
  const t = useTranslations('edgeTrigger.interaction');
  const options = USER_ACTIONS_BUILTIN;
  const [custom, setCustom] = useState(false);
  const [draft, setDraft] = useState(value);

  if (custom) {
    return (
      <div className="space-y-1">
        <input
          id={id}
          className={identifierInputCls}
          value={draft}
          onChange={(e) => {
            setDraft(e.target.value);
            onCustomDraftChange(e.target.value);
          }}
          // biome-ignore lint/a11y/noAutofocus: focusing the action on open is the point
          autoFocus
        />
        <button
          type="button"
          className="text-xs text-accent-primary-solid hover:underline dark:text-accent-primary"
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
      className={identifierInputCls}
      value={inList ? value : '__current__'}
      onChange={(e) => {
        if (e.target.value === '__custom__') {
          setDraft(value);
          setCustom(true);
          return;
        }
        if (e.target.value !== '__current__') onPick(e.target.value);
      }}
    >
      {!inList && <option value="__current__">{t('customValue', { value })}</option>}
      {options.map((action) => (
        <option key={action} value={action} disabled={disabledActions.has(action)}>
          {action}
        </option>
      ))}
      <option value="__custom__">{t('customOption')}</option>
    </select>
  );
}

export function EdgeTriggerEditor({
  edgeId,
  flow,
  anchorAt,
  actions,
  onClose,
}: {
  edgeId: string;
  flow: Flow;
  anchorAt: { x: number; y: number };
  actions: EdgeTriggerActions;
  onClose: () => void;
}) {
  const t = useTranslations('edgeTrigger');
  const edge = flow.edges.find((e) => e.id === edgeId);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(120);
  const [shown, setShown] = useState(false);
  const closingRef = useRef(false);

  const sibling = edge ? findSwappableSiblingEdge(flow, edge) : null;
  const usedActions = edge ? usedScreenInteractionActions(flow, edge) : new Set<string>();

  const [draftAction, setDraftAction] = useState(() => {
    const initial = flow.edges.find((e) => e.id === edgeId);
    return initial?.trigger.type === 'interaction' ? initial.trigger.action : '';
  });

  const [openedEdgeId, setOpenedEdgeId] = useState(edgeId);
  if (edgeId !== openedEdgeId) {
    setOpenedEdgeId(edgeId);
    const initial = flow.edges.find((e) => e.id === edgeId);
    setDraftAction(initial?.trigger.type === 'interaction' ? initial.trigger.action : '');
  }

  const position = placeFloatingPanelAtPoint(anchorAt, {
    width: PANEL_WIDTH,
    height: panelHeight,
  });

  const closeAnimated = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setShown(false);
    window.setTimeout(onClose, MOTION_DURATION_BASE_MS);
  }, [onClose]);

  const closeHandlerRef = useRef<() => void>(() => {});
  const pickInteractionRef = useRef<(action: string) => void>(() => {});

  useLayoutEffect(() => {
    pickInteractionRef.current = (action: string) => {
      const trimmed = action.trim();
      if (trimmed.length === 0) return;
      const current = flow.edges.find((e) => e.id === edgeId);
      if (current?.trigger.type === 'interaction' && trimmed !== current.trigger.action) {
        actions.setTrigger(edgeId, { type: 'interaction', action: trimmed });
      }
      closeAnimated();
    };
  }, [actions, closeAnimated, edgeId, flow.edges]);

  useLayoutEffect(() => {
    closeHandlerRef.current = () => {
      const current = flow.edges.find((e) => e.id === edgeId);
      if (current?.trigger.type === 'interaction') {
        const next = draftAction.trim();
        if (next.length > 0 && next !== current.trigger.action) {
          actions.setTrigger(edgeId, { type: 'interaction', action: next });
        }
      }
      closeAnimated();
    };
  }, [actions, closeAnimated, draftAction, edgeId, flow.edges]);

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

  if (!edge) return null;

  const currentLabel = labelFor(edge.trigger) ?? edge.trigger.type;
  const siblingLabel = sibling ? (labelFor(sibling.trigger) ?? sibling.trigger.type) : null;

  const onSwap = () => {
    if (!sibling) return;
    actions.swapWithSibling(edgeId, sibling.id);
    closeAnimated();
  };

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="edge-trigger-editor-title"
      className={`fixed z-50 flex flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-panel shadow-2xl transition-[opacity,transform] duration-[var(--duration-base)] ease-standard dark:border-border-default ${shown ? 'translate-y-0 opacity-100' : 'translate-y-1 opacity-0'}`}
      style={{
        left: position.left,
        top: position.top,
        width: PANEL_WIDTH,
      }}
    >
      <div className="flex items-center gap-1.5 border-border-subtle border-b px-2.5 py-1 dark:border-border-default">
        <span
          id="edge-trigger-editor-title"
          className="min-w-0 flex-1 text-sm font-medium text-fg-default"
        >
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
      <div className="space-y-3 p-3">
        {sibling && siblingLabel && (
          <div className="space-y-2">
            <p className="text-xs text-fg-subtle">
              {t('closedPair.current', { label: currentLabel })}
            </p>
            <button
              type="button"
              className="w-full rounded border border-border-default bg-bg-subtle px-2 py-1.5 text-sm text-fg-default hover:bg-bg-muted dark:border-border-default dark:bg-bg-subtle dark:hover:bg-bg-muted"
              onClick={onSwap}
            >
              {t('closedPair.swap', { label: siblingLabel })}
            </button>
          </div>
        )}

        {edge.trigger.type === 'interaction' && (
          <label className="block space-y-1" htmlFor={`edge-action-${edgeId}`}>
            <span className={labelCls}>{t('interaction.label')}</span>
            <InteractionActionSelect
              id={`edge-action-${edgeId}`}
              value={edge.trigger.type === 'interaction' ? edge.trigger.action : draftAction}
              disabledActions={usedActions}
              onPick={(action) => pickInteractionRef.current(action)}
              onCustomDraftChange={setDraftAction}
            />
          </label>
        )}
      </div>
    </div>
  );
}
