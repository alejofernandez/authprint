'use client';

import type { Flow, Scenario } from '@authprint/dsl';
import {
  type ReactNode,
  type RefObject,
  useEffect,
  useLayoutEffect,
  useRef,
  useState,
} from 'react';

export type TransportLabels = {
  stepBack: string;
  stepForward: string;
  play: string;
  pause: string;
  exit: string;
  scenarioPickerOpen: string;
  scenarioPickerCurrent: string;
  dragHandle: string;
  collapse: string;
  expand: string;
};

/** Keep the floating transport pill off the preview edges. */
const TRANSPORT_BOUNDS_INSET = 12;

function clampTransportPosition(
  x: number,
  y: number,
  bounds: DOMRect,
  pillWidth: number,
  pillHeight: number,
) {
  const inset = TRANSPORT_BOUNDS_INSET;
  const maxX = Math.max(bounds.width - pillWidth - inset, inset);
  const maxY = Math.max(bounds.height - pillHeight - inset, inset);
  return {
    x: Math.min(Math.max(x, inset), maxX),
    y: Math.min(Math.max(y, inset), maxY),
  };
}

function positionFromAnchor(
  anchor: { x: number; y: number },
  pillWidth: number,
  pillHeight: number,
  boundsRect: DOMRect,
) {
  return clampTransportPosition(
    anchor.x - pillWidth / 2,
    anchor.y - pillHeight / 2,
    boundsRect,
    pillWidth,
    pillHeight,
  );
}

function reclampTransportPosition(
  current: { x: number; y: number },
  boundsRect: DOMRect,
  pillWidth: number,
  pillHeight: number,
) {
  const next = clampTransportPosition(current.x, current.y, boundsRect, pillWidth, pillHeight);
  if (next.x === current.x && next.y === current.y) return current;
  return next;
}

export function PlayerTransportPill({
  boundsRef,
  name,
  scenarios,
  activeScenarioId,
  onSelectScenario,
  playing,
  atStart,
  atEnd,
  diverged,
  onTogglePlay,
  onPrev,
  onNext,
  onExit,
  stepCurrent,
  stepTotal,
  labels,
  onNewScenario,
  newScenarioLabel,
  mode,
  onSetMode,
  modeLabels,
}: {
  boundsRef: RefObject<HTMLDivElement | null>;
  name: string;
  scenarios: Flow['scenarios'];
  activeScenarioId: string;
  onSelectScenario: (scenario: Scenario) => void;
  playing: boolean;
  atStart: boolean;
  atEnd: boolean;
  diverged: boolean;
  onTogglePlay: () => void;
  onPrev: () => void;
  onNext: () => void;
  onExit: () => void;
  stepCurrent: number;
  stepTotal: number;
  labels: TransportLabels;
  onNewScenario?: () => void;
  newScenarioLabel?: string;
  /** Edit⇄Play toggle, docked in the pill (replaces the old header band). */
  mode?: 'edit' | 'play';
  onSetMode?: (mode: 'edit' | 'play') => void;
  modeLabels?: { edit: string; play: string };
}) {
  const pillRef = useRef<HTMLDivElement>(null);
  const dragOffsetRef = useRef({ x: 0, y: 0 });
  const pointerMovedRef = useRef(false);
  const compactClickTimeoutRef = useRef<number | null>(null);
  const compactAnchorRef = useRef<{ x: number; y: number } | null>(null);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [compact, setCompact] = useState(false);
  const [position, setPosition] = useState<{ x: number; y: number } | null>(null);
  const canPickScenario = scenarios.length > 1 || Boolean(onNewScenario);

  const captureAnchorAndSetCompact = (next: boolean) => {
    const bounds = boundsRef.current;
    const pill = pillRef.current;
    if (bounds && pill) {
      const boundsRect = bounds.getBoundingClientRect();
      const pillRect = pill.getBoundingClientRect();
      compactAnchorRef.current = {
        x: pillRect.left - boundsRect.left + pillRect.width / 2,
        y: pillRect.top - boundsRect.top + pillRect.height / 2,
      };
    }
    setCompact(next);
  };

  useLayoutEffect(() => {
    if (position !== null) return;
    const bounds = boundsRef.current;
    const pill = pillRef.current;
    if (!bounds || !pill) return;
    const boundsRect = bounds.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    setPosition(
      clampTransportPosition(
        (boundsRect.width - pillRect.width) / 2,
        boundsRect.height - pillRect.height - TRANSPORT_BOUNDS_INSET,
        boundsRect,
        pillRect.width,
        pillRect.height,
      ),
    );
  }, [boundsRef, position]);

  // Re-anchor when compact toggles — grow/shrink symmetrically around the prior pill center.
  // biome-ignore lint/correctness/useExhaustiveDependencies: run only when compact toggles
  useLayoutEffect(() => {
    const anchor = compactAnchorRef.current;
    if (!anchor || !boundsRef.current || !pillRef.current) return;
    const boundsRect = boundsRef.current.getBoundingClientRect();
    const pill = pillRef.current;
    setPosition((current) => {
      if (!current) return current;
      const next = positionFromAnchor(anchor, pill.offsetWidth, pill.offsetHeight, boundsRect);
      if (next.x === current.x && next.y === current.y) return current;
      return next;
    });
    compactAnchorRef.current = null;
  }, [compact]);

  // Keep the pill inside the preview when the viewport or drawer resizes the bounds.
  useLayoutEffect(() => {
    const bounds = boundsRef.current;
    if (!bounds) return;

    const reclamp = () => {
      const pill = pillRef.current;
      if (!pill) return;
      const boundsRect = bounds.getBoundingClientRect();
      setPosition((current) => {
        if (!current) return current;
        return reclampTransportPosition(current, boundsRect, pill.offsetWidth, pill.offsetHeight);
      });
    };

    const observer = new ResizeObserver(reclamp);
    observer.observe(bounds);
    return () => observer.disconnect();
  }, [boundsRef]);

  const beginDrag = (clientX: number, clientY: number) => {
    const bounds = boundsRef.current;
    const pill = pillRef.current;
    if (!bounds || !pill) return;
    const boundsRect = bounds.getBoundingClientRect();
    const pillRect = pill.getBoundingClientRect();
    dragOffsetRef.current = {
      x: clientX - pillRect.left,
      y: clientY - pillRect.top,
    };
    setPosition(
      clampTransportPosition(
        pillRect.left - boundsRect.left,
        pillRect.top - boundsRect.top,
        boundsRect,
        pillRect.width,
        pillRect.height,
      ),
    );
    setDragging(true);
  };

  const moveDrag = (clientX: number, clientY: number) => {
    if (!dragging) return;
    pointerMovedRef.current = true;
    const bounds = boundsRef.current;
    const pill = pillRef.current;
    if (!bounds || !pill) return;
    const boundsRect = bounds.getBoundingClientRect();
    setPosition(
      clampTransportPosition(
        clientX - boundsRect.left - dragOffsetRef.current.x,
        clientY - boundsRect.top - dragOffsetRef.current.y,
        boundsRect,
        pill.offsetWidth,
        pill.offsetHeight,
      ),
    );
  };

  const onDragHandlePointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!boundsRef.current || !pillRef.current) return;
    event.preventDefault();
    event.stopPropagation();
    setPickerOpen(false);
    pointerMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDrag(event.clientX, event.clientY);
  };

  const onDragHandlePointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    moveDrag(event.clientX, event.clientY);
  };

  const onCompactPointerDown = (event: React.PointerEvent<HTMLButtonElement>) => {
    if (!boundsRef.current || !pillRef.current) return;
    event.preventDefault();
    pointerMovedRef.current = false;
    event.currentTarget.setPointerCapture(event.pointerId);
    beginDrag(event.clientX, event.clientY);
  };

  const onCompactPointerMove = (event: React.PointerEvent<HTMLButtonElement>) => {
    moveDrag(event.clientX, event.clientY);
  };

  const onCompactPointerUp = () => {
    setDragging(false);
  };

  const onCompactClick = () => {
    if (pointerMovedRef.current) {
      pointerMovedRef.current = false;
      return;
    }
    if (compactClickTimeoutRef.current) window.clearTimeout(compactClickTimeoutRef.current);
    compactClickTimeoutRef.current = window.setTimeout(() => {
      compactClickTimeoutRef.current = null;
      if (!(atEnd && !diverged && !playing)) onTogglePlay();
    }, 220);
  };

  const onCompactDoubleClick = (event: React.MouseEvent<HTMLButtonElement>) => {
    event.preventDefault();
    if (compactClickTimeoutRef.current) {
      window.clearTimeout(compactClickTimeoutRef.current);
      compactClickTimeoutRef.current = null;
    }
    pointerMovedRef.current = false;
    captureAnchorAndSetCompact(false);
  };

  const finishDrag = () => {
    if (dragging && !pointerMovedRef.current && !compact) {
      captureAnchorAndSetCompact(true);
    }
    setDragging(false);
  };

  const pillStyle =
    position !== null
      ? { left: position.x, top: position.y }
      : { left: '50%', bottom: TRANSPORT_BOUNDS_INSET, transform: 'translateX(-50%)' };

  const gripLabel = compact ? labels.expand : labels.collapse;
  const playLabel = playing ? labels.pause : labels.play;

  const pillTone = diverged
    ? 'border-signal-error-border bg-signal-error-bg/95 text-signal-error-label dark:border-signal-error-border-strong dark:bg-signal-error-bg-muted dark:text-signal-error-label'
    : 'border-accent-primary-border-muted bg-bg-panel/95 text-accent-primary-fg-emphasis dark:border-accent-primary-border-muted dark:bg-bg-panel/90 dark:text-accent-primary-fg-on-bg';

  return (
    <div
      ref={pillRef}
      className="absolute z-30 w-fit"
      style={pillStyle}
      data-testid="player-transport"
      data-compact={compact || undefined}
    >
      {compact ? (
        <button
          type="button"
          aria-label={playLabel}
          title={`${playLabel}. Double-click to expand.`}
          className={`flex touch-none items-center rounded-full border px-3 py-1.5 text-sm font-medium shadow-lg backdrop-blur ${pillTone} ${
            dragging ? 'cursor-grabbing' : 'cursor-grab'
          } ${atEnd && !diverged && !playing ? 'opacity-60' : ''}`}
          onClick={onCompactClick}
          onDoubleClick={onCompactDoubleClick}
          onPointerDown={onCompactPointerDown}
          onPointerMove={onCompactPointerMove}
          onPointerUp={onCompactPointerUp}
          onPointerCancel={onCompactPointerUp}
        >
          {playing ? '⏸' : '▶'}
          <span className="sr-only">
            {playLabel}. {labels.expand}. Double-click to expand.
          </span>
        </button>
      ) : (
        <div
          className={`flex w-max max-w-[calc(100vw-2rem)] items-center gap-1 rounded-full border px-1 py-1.5 shadow-lg backdrop-blur ${pillTone} ${
            dragging ? 'cursor-grabbing' : ''
          }`}
        >
          <button
            type="button"
            aria-label={`${labels.dragHandle}. ${gripLabel}`}
            title={`${labels.dragHandle}. ${gripLabel}`}
            onPointerDown={onDragHandlePointerDown}
            onPointerMove={onDragHandlePointerMove}
            onPointerUp={finishDrag}
            onPointerCancel={finishDrag}
            className="ml-0.5 flex shrink-0 cursor-grab touch-none rounded-full px-1.5 py-1 text-fg-subtle hover:bg-black/5 active:cursor-grabbing dark:hover:bg-white/10"
          >
            <DragHandleIcon />
          </button>
          {mode && onSetMode && modeLabels ? (
            <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
              <ModeSegment
                active={mode === 'edit'}
                label={modeLabels.edit}
                onClick={() => onSetMode('edit')}
              />
              <ModeSegment
                active={mode === 'play'}
                label={modeLabels.play}
                onClick={() => onSetMode('play')}
              />
            </div>
          ) : null}
          <div className="relative min-w-0 shrink">
            {canPickScenario ? (
              <button
                type="button"
                aria-haspopup="menu"
                aria-expanded={pickerOpen}
                aria-label={labels.scenarioPickerOpen}
                title={name}
                onClick={() => setPickerOpen((open) => !open)}
                className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-1 text-left text-sm font-medium hover:bg-black/5 dark:hover:bg-white/10"
              >
                <span className="min-w-0 truncate">{name}</span>
                <ChevronDownIcon />
              </button>
            ) : (
              <span className="block whitespace-nowrap px-2 text-sm font-medium" title={name}>
                {name}
              </span>
            )}

            {pickerOpen ? (
              <>
                <button
                  type="button"
                  aria-label={labels.scenarioPickerOpen}
                  className="fixed inset-0 z-40 cursor-default"
                  onClick={() => setPickerOpen(false)}
                />
                <div
                  role="menu"
                  className="absolute bottom-full left-0 z-50 mb-2 max-h-48 min-w-[16rem] max-w-96 overflow-auto rounded-lg border border-border-subtle bg-bg-panel py-1 text-left shadow-lg dark:border-border-default dark:bg-bg-panel"
                  aria-label={labels.scenarioPickerOpen}
                >
                  {onNewScenario && newScenarioLabel ? (
                    <button
                      key="__new"
                      type="button"
                      role="menuitem"
                      className="block w-full truncate px-3 py-1.5 text-left text-sm font-medium text-accent-primary-fg-emphasis hover:bg-black/5 dark:hover:bg-white/10"
                      onClick={() => {
                        onNewScenario();
                        setPickerOpen(false);
                      }}
                    >
                      {newScenarioLabel}
                    </button>
                  ) : null}
                  {scenarios.map((scenario) => {
                    const active = scenario.id === activeScenarioId;
                    return (
                      <button
                        key={scenario.id}
                        type="button"
                        role="menuitem"
                        className={`block w-full truncate px-3 py-1.5 text-left text-sm hover:bg-black/5 dark:hover:bg-white/10 ${
                          active
                            ? 'font-semibold text-accent-primary-fg-emphasis'
                            : 'text-fg-default'
                        }`}
                        title={scenario.name}
                        aria-current={active ? 'true' : undefined}
                        onClick={() => {
                          if (!active) onSelectScenario(scenario);
                          setPickerOpen(false);
                        }}
                      >
                        {active ? (
                          <span className="sr-only">{labels.scenarioPickerCurrent}: </span>
                        ) : null}
                        {scenario.name}
                      </button>
                    );
                  })}
                </div>
              </>
            ) : null}
          </div>

          <span
            role="status"
            className="inline-flex w-[4.5rem] shrink-0 justify-center font-mono text-xs tabular-nums opacity-70"
            aria-live="polite"
            aria-label={`Step ${stepCurrent} of ${stepTotal}`}
          >
            <span className="inline-block w-[1.5rem] text-right">{stepCurrent}</span>
            <span className="px-0.5">/</span>
            <span className="inline-block w-[1.5rem] text-left">{stepTotal}</span>
          </span>
          <ControlDivider />
          {playing ? (
            <ControlButton label={labels.pause} onClick={onTogglePlay}>
              ⏸
            </ControlButton>
          ) : (
            <ControlButton label={labels.play} onClick={onTogglePlay} disabled={atEnd && !diverged}>
              ▶
            </ControlButton>
          )}
          <ControlButton label={labels.stepBack} onClick={onPrev} disabled={atStart}>
            ←
          </ControlButton>
          <ControlButton label={labels.stepForward} onClick={onNext} disabled={atEnd}>
            →
          </ControlButton>
          <ControlDivider />
          <ControlButton label={labels.collapse} onClick={() => captureAnchorAndSetCompact(true)}>
            −
          </ControlButton>
          <ControlButton label={labels.exit} onClick={onExit} iconOnly className="mr-1.5">
            ×
          </ControlButton>
        </div>
      )}
    </div>
  );
}

export type EditManage = {
  scenarioId: string;
  onCommitName: (name: string) => void;
  onDuplicate: () => void;
  onRequestDelete: () => void;
  labels: {
    panelTitle: string;
    nameLabel: string;
    duplicate: string;
    delete: string;
    close: string;
  };
};

function ManageScenarioPopover({
  name,
  editManage,
  onClose,
}: {
  name: string;
  editManage: EditManage;
  onClose: () => void;
}) {
  // Escape closes only this popover. The player's own Escape handler exits to
  // the canvas, so intercept in the capture phase while open.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener('keydown', onKey, true);
    return () => document.removeEventListener('keydown', onKey, true);
  }, [onClose]);

  return (
    <>
      <button
        type="button"
        aria-label={editManage.labels.close}
        className="fixed inset-0 z-40 cursor-default"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-label={editManage.labels.panelTitle}
        className="absolute bottom-full left-0 z-50 mb-2 w-64 rounded-lg border border-border-subtle bg-bg-panel p-3 text-left shadow-lg dark:border-border-default dark:bg-bg-panel"
      >
        <div className="flex items-center justify-between gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-fg-subtle">
            {editManage.labels.panelTitle}
          </span>
          <button
            type="button"
            aria-label={editManage.labels.close}
            onClick={onClose}
            className="shrink-0 rounded p-0.5 text-fg-subtle hover:bg-bg-subtle hover:text-fg-muted"
          >
            ✕
          </button>
        </div>
        <label className="mt-2 block text-[11px] text-fg-subtle" htmlFor="pill-scenario-name">
          {editManage.labels.nameLabel}
        </label>
        <input
          id="pill-scenario-name"
          key={editManage.scenarioId}
          type="text"
          defaultValue={name}
          onBlur={(e) => editManage.onCommitName(e.currentTarget.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') e.currentTarget.blur();
          }}
          className="mt-1 h-8 w-full rounded-md border border-border-strong bg-bg-canvas px-2 text-sm font-medium text-fg-default focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border dark:border-border-default"
        />
        <div className="mt-3 flex items-center gap-2">
          <button
            type="button"
            onClick={() => {
              editManage.onDuplicate();
              onClose();
            }}
            className="flex-1 rounded-md border border-border-strong px-2.5 py-1.5 text-center text-sm text-fg-default hover:bg-bg-subtle dark:border-border-default"
          >
            {editManage.labels.duplicate}
          </button>
          <button
            type="button"
            onClick={() => {
              editManage.onRequestDelete();
              onClose();
            }}
            className="flex-1 rounded-md border border-border-default px-2.5 py-1.5 text-center text-sm text-signal-error-label transition-colors duration-[var(--duration-fast)] ease-standard hover:border-signal-error-border hover:bg-signal-error-bg"
          >
            {editManage.labels.delete}
          </button>
        </div>
      </div>
    </>
  );
}

/**
 * Edit mode's transport: docked above the filmstrip instead of floating over
 * the stage, so recording affordances are never covered (UF-019).
 */
export function PlayerTransportDock({
  name,
  mode,
  onSetMode,
  modeLabels,
  editManage,
  onExit,
  exitLabel,
}: {
  name: string;
  mode: 'edit' | 'play';
  onSetMode: (mode: 'edit' | 'play') => void;
  modeLabels: { edit: string; play: string };
  editManage: EditManage;
  onExit: () => void;
  exitLabel: string;
}) {
  const [managerOpen, setManagerOpen] = useState(false);

  return (
    <div
      className="relative flex shrink-0 items-center justify-center gap-2 border-border-subtle border-t bg-bg-panel/95 px-12 py-1.5 dark:border-border-default"
      data-testid="player-transport-dock"
    >
      <div className="flex shrink-0 items-center gap-0.5 rounded-full bg-black/5 p-0.5 dark:bg-white/10">
        <ModeSegment
          active={mode === 'edit'}
          label={modeLabels.edit}
          onClick={() => onSetMode('edit')}
        />
        <ModeSegment
          active={mode === 'play'}
          label={modeLabels.play}
          onClick={() => onSetMode('play')}
        />
      </div>
      <div className="relative min-w-0 shrink">
        <button
          type="button"
          aria-haspopup="dialog"
          aria-expanded={managerOpen}
          aria-label={editManage.labels.panelTitle}
          title={name}
          onClick={() => setManagerOpen((open) => !open)}
          className="inline-flex max-w-full min-w-0 items-center gap-1 rounded-full px-2 py-1 text-left text-sm font-medium text-fg-default hover:bg-black/5 dark:hover:bg-white/10"
        >
          <span className="min-w-0 truncate">{name}</span>
          <ChevronDownIcon />
        </button>
        {managerOpen ? (
          <ManageScenarioPopover
            name={name}
            editManage={editManage}
            onClose={() => setManagerOpen(false)}
          />
        ) : null}
      </div>
      <button
        type="button"
        aria-label={exitLabel}
        title={exitLabel}
        onClick={onExit}
        className="absolute right-3 shrink-0 rounded-full px-2 py-1 text-base leading-none text-fg-muted hover:bg-black/5 dark:hover:bg-white/10"
      >
        ×
      </button>
    </div>
  );
}

function ModeSegment({
  active,
  label,
  onClick,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={`shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium transition-colors duration-[var(--duration-fast)] ease-standard focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-accent-primary-border ${
        active
          ? 'bg-accent-primary-solid text-white shadow-sm'
          : 'text-fg-muted hover:text-fg-default'
      }`}
    >
      {label}
    </button>
  );
}

function DragHandleIcon() {
  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 opacity-70"
      fill="currentColor"
    >
      <circle cx="5" cy="4" r="1.1" />
      <circle cx="11" cy="4" r="1.1" />
      <circle cx="5" cy="8" r="1.1" />
      <circle cx="11" cy="8" r="1.1" />
      <circle cx="5" cy="12" r="1.1" />
      <circle cx="11" cy="12" r="1.1" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg
      aria-hidden
      role="presentation"
      viewBox="0 0 16 16"
      className="h-3.5 w-3.5 shrink-0 opacity-70"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M4 6l4 4 4-4" />
    </svg>
  );
}

function ControlDivider() {
  return <span className="mx-0.5 h-5 w-px shrink-0 bg-current opacity-20" aria-hidden="true" />;
}

function ControlButton({
  label,
  onClick,
  disabled,
  iconOnly,
  className,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  iconOnly?: boolean;
  className?: string;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className={`shrink-0 rounded-full py-1 text-sm disabled:cursor-not-allowed disabled:opacity-35 hover:bg-black/5 dark:hover:bg-white/10 ${
        iconOnly ? 'px-2 text-base leading-none' : 'px-2.5'
      } ${className ?? ''}`}
    >
      {children}
    </button>
  );
}
