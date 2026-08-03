// Floating node-type quick-pick (E26): the structural-type menu shared by
// the per-handle `+` (US-049) and drag-from-handle (US-050). Five creatable
// types — never Entry (one per flow). Keyboard-navigable (↑/↓/Enter/Esc).
// `+` opens node-anchored (same placement as the inspector); drag-drop uses
// the release point.

'use client';

import { useReactFlow, useStore } from '@xyflow/react';
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import {
  nodeScreenRect,
  PLUS_AFFORDANCE_GAP,
  placeFloatingPanel,
  placeFloatingPanelAbove,
  placeFloatingPanelAtPoint,
  placeFloatingPanelBelow,
} from './floatingPanelPlacement.ts';
import { CREATABLE_TYPES, type CreatableType } from './ydoc/create.ts';

const TYPE_META: Record<CreatableType, { label: string; dot: string }> = {
  screen: { label: 'Screen', dot: 'bg-accent-primary' },
  decision: { label: 'Decision', dot: 'bg-node-decision-accent' },
  action: { label: 'Action', dot: 'bg-fg-subtle' },
  external: { label: 'External', dot: 'bg-fg-subtle' },
  outcome: { label: 'Outcome', dot: 'bg-node-outcome-accent' },
};

const PANEL_WIDTH = 160;

export type NodeTypePickerPlacement =
  | { kind: 'node'; sourceId: string; side: 'top' | 'right' | 'bottom' }
  | { kind: 'point'; at: { x: number; y: number } };

export function NodeTypePicker({
  placement,
  onPick,
  onConnectExisting,
  onClose,
}: {
  placement: NodeTypePickerPlacement;
  onPick: (type: CreatableType) => void;
  /** US-137: enter target-pick mode instead of creating a node. Absent when the
   *  picker has no source handle to draw from (free placement, US-133). */
  onConnectExisting?: () => void;
  onClose: () => void;
}) {
  const [active, setActive] = useState(0);
  const ref = useRef<HTMLDivElement>(null);
  const { getNode, flowToScreenPosition } = useReactFlow();
  const transform = useStore((s) => s.transform);
  const [panelHeight, setPanelHeight] = useState(220);

  useEffect(() => {
    ref.current?.focus();
  }, []);

  useLayoutEffect(() => {
    const el = ref.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => {
      const h = entry?.contentRect.height;
      if (h) setPanelHeight(h);
    });
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const position = useMemo(() => {
    void transform;
    const panel = { width: PANEL_WIDTH, height: panelHeight };
    if (placement.kind === 'point') {
      return placeFloatingPanelAtPoint(placement.at, panel);
    }
    const anchor = nodeScreenRect(getNode(placement.sourceId), flowToScreenPosition);
    if (!anchor) return { left: 24, top: 24 };
    const pickerGap = { affordanceGap: PLUS_AFFORDANCE_GAP };
    if (placement.side === 'right') {
      return placeFloatingPanel(anchor, panel, pickerGap);
    }
    if (placement.side === 'top') {
      return placeFloatingPanelAbove(anchor, panel, pickerGap);
    }
    return placeFloatingPanelBelow(anchor, panel, pickerGap);
  }, [placement, getNode, flowToScreenPosition, transform, panelHeight]);

  // The connect row is one past the last type, so arrow keys walk it like any
  // other row rather than needing a second navigation model.
  const rowCount = CREATABLE_TYPES.length + (onConnectExisting ? 1 : 0);
  const connectRowIndex = onConnectExisting ? CREATABLE_TYPES.length : -1;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        onClose();
      } else if (e.key === 'ArrowDown') {
        e.preventDefault();
        setActive((i) => (i + 1) % rowCount);
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        setActive((i) => (i - 1 + rowCount) % rowCount);
      } else if (e.key === 'Enter') {
        e.preventDefault();
        if (active === connectRowIndex) {
          onConnectExisting?.();
          return;
        }
        const type = CREATABLE_TYPES[active];
        if (type) onPick(type);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active, onPick, onClose, onConnectExisting, rowCount, connectRowIndex]);

  return (
    <>
      {/* Pointer-only dismiss: out of the tab order (US-135 / US-131 catalog).
          Escape is the keyboard path; mirroring CanvasContextMenu. */}
      <button
        type="button"
        aria-hidden="true"
        tabIndex={-1}
        aria-label="Close menu"
        // Above the inspector (z-50), not below it: this menu can be opened
        // *from* the inspector ("+ Add action"), and a dismiss layer underneath
        // its opener leaves both panels live at once.
        className="fixed inset-0 z-[55] cursor-default"
        onClick={onClose}
      />
      <div
        ref={ref}
        tabIndex={-1}
        role="listbox"
        aria-label="Node type"
        // z-[60] matches HandlePlus's anchored tier: a transient menu sits above
        // every panel, including the inspector that can open it. At z-50 it tied
        // with NodeInspector and lost on DOM order, so "+ Add action" looked
        // like it did nothing until the inspector was closed.
        className="fixed z-[60] w-40 overflow-hidden rounded-lg border border-border-subtle bg-bg-panel p-1 shadow-xl outline-none dark:border-border-default"
        style={{ left: position.left, top: position.top }}
      >
        <div className="px-2 py-1 text-[10px] font-medium text-fg-subtle uppercase tracking-wider">
          Add node
        </div>
        {CREATABLE_TYPES.map((type, i) => (
          <button
            key={type}
            type="button"
            role="option"
            tabIndex={-1}
            aria-selected={i === active}
            onMouseEnter={() => setActive(i)}
            onClick={() => onPick(type)}
            className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
              i === active
                ? 'bg-accent-primary-selected-bg text-accent-primary-selected-fg'
                : 'text-fg-secondary dark:text-fg-muted'
            }`}
          >
            <span className={`h-2.5 w-2.5 rounded-full ${TYPE_META[type].dot}`} />
            {TYPE_META[type].label}
          </button>
        ))}
        {onConnectExisting ? (
          <>
            <div className="my-1 border-border-subtle border-t dark:border-border-default" />
            <button
              type="button"
              role="option"
              tabIndex={-1}
              aria-selected={active === connectRowIndex}
              onMouseEnter={() => setActive(connectRowIndex)}
              onClick={onConnectExisting}
              className={`flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm ${
                active === connectRowIndex
                  ? 'bg-accent-primary-selected-bg text-accent-primary-selected-fg'
                  : 'text-fg-secondary dark:text-fg-muted'
              }`}
            >
              <span aria-hidden="true" className="w-2.5 text-center text-fg-subtle">
                ⇥
              </span>
              Connect to existing…
            </button>
          </>
        ) : null}
      </div>
    </>
  );
}
