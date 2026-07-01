// Node Inspector (§7 surface #2): floating, node-anchored editor shell.
// Anchors beside the node's screen rect (right + ⅛-width gap, vertically
// centered), flips left when clipped, scrollable body, draggable header.

'use client';

import type { Node as DslNode } from '@authprint/dsl';
import { useReactFlow, useStore } from '@xyflow/react';
import { type ReactNode, useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { nodeScreenRect, PANEL_MAX_HEIGHT, placeFloatingPanel } from './floatingPanelPlacement.ts';

const TYPE_META: Record<Exclude<DslNode['type'], 'entry'>, { label: string; dot: string }> = {
  screen: { label: 'Screen', dot: 'bg-accent-primary' },
  decision: { label: 'Decision', dot: 'bg-node-decision-accent' },
  action: { label: 'Action', dot: 'bg-fg-subtle' },
  external: { label: 'External', dot: 'bg-fg-subtle' },
  outcome: { label: 'Outcome', dot: 'bg-node-outcome-accent' },
};

const PANEL_WIDTH = 288;

export function NodeInspector({
  nodeId,
  node,
  onClose,
  children,
}: {
  nodeId: string;
  node: DslNode;
  onClose: () => void;
  children: ReactNode;
}) {
  const { getNode, flowToScreenPosition } = useReactFlow();
  // Re-anchor when the user pans/zooms or moves the node.
  const transform = useStore((s) => s.transform);
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelHeight, setPanelHeight] = useState(320);
  const [dragPos, setDragPos] = useState<{ left: number; top: number } | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    startX: number;
    startY: number;
    origLeft: number;
    origTop: number;
  } | null>(null);

  const anchor = useMemo(() => {
    void transform;
    return nodeScreenRect(getNode(nodeId), flowToScreenPosition);
  }, [nodeId, getNode, flowToScreenPosition, transform]);

  const autoPos = useMemo(() => {
    if (!anchor) return { left: 24, top: 24 };
    return placeFloatingPanel(anchor, { width: PANEL_WIDTH, height: panelHeight });
  }, [anchor, panelHeight]);

  const position = dragPos ?? autoPos;

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

  // Esc closes; click outside closes (commit-on-change — nothing lost).
  useLayoutEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    const onDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) onClose();
    };
    document.addEventListener('keydown', onKey);
    document.addEventListener('mousedown', onDown);
    return () => {
      document.removeEventListener('keydown', onKey);
      document.removeEventListener('mousedown', onDown);
    };
  }, [onClose]);

  const onHeaderPointerDown = useCallback(
    (e: React.PointerEvent) => {
      if ((e.target as HTMLElement).closest('button')) return;
      dragRef.current = {
        pointerId: e.pointerId,
        startX: e.clientX,
        startY: e.clientY,
        origLeft: position.left,
        origTop: position.top,
      };
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [position.left, position.top],
  );

  const onHeaderPointerMove = useCallback((e: React.PointerEvent) => {
    const d = dragRef.current;
    if (!d || d.pointerId !== e.pointerId) return;
    setDragPos({
      left: d.origLeft + (e.clientX - d.startX),
      top: d.origTop + (e.clientY - d.startY),
    });
  }, []);

  const onHeaderPointerUp = useCallback((e: React.PointerEvent) => {
    if (dragRef.current?.pointerId === e.pointerId) {
      dragRef.current = null;
      (e.currentTarget as HTMLElement).releasePointerCapture(e.pointerId);
    }
  }, []);

  const meta = TYPE_META[node.type as keyof typeof TYPE_META];

  return (
    <div
      ref={panelRef}
      role="dialog"
      aria-labelledby="node-inspector-title"
      className="fixed z-50 flex w-72 flex-col overflow-hidden rounded-lg border border-border-subtle bg-bg-panel shadow-2xl dark:border-border-default"
      style={{
        left: position.left,
        top: position.top,
        maxHeight: `min(70dvh, ${PANEL_MAX_HEIGHT}px)`,
      }}
    >
      <div
        className="flex cursor-grab items-center gap-1.5 border-border-subtle border-b px-2.5 py-1 active:cursor-grabbing dark:border-border-default"
        onPointerDown={onHeaderPointerDown}
        onPointerMove={onHeaderPointerMove}
        onPointerUp={onHeaderPointerUp}
        onPointerCancel={onHeaderPointerUp}
      >
        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${meta.dot}`} aria-hidden />
        <span
          id="node-inspector-title"
          className="min-w-0 flex-1 text-sm font-medium text-fg-default"
        >
          {meta.label}
        </span>
        <button
          type="button"
          aria-label="Close"
          className="shrink-0 rounded p-0.5 text-fg-subtle outline-none hover:bg-bg-subtle hover:text-fg-muted focus-visible:ring-2 focus-visible:ring-accent-primary-border dark:hover:bg-bg-subtle dark:hover:text-fg-soft"
          onClick={onClose}
        >
          ✕
        </button>
      </div>
      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain p-3">{children}</div>
    </div>
  );
}
