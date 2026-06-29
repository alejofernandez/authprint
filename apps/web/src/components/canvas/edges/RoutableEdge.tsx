'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, useReactFlow } from '@xyflow/react';
import { useCallback, useLayoutEffect, useMemo, useRef, useState } from 'react';
import type { Position } from '../ydoc/schema.ts';
import { useSetEdgeRoute } from './edgeRouteContext.tsx';
import {
  buildRoutedPath,
  clampAxisCenter,
  type DragSpineSegment,
  encodeBackEdgeWaypoint,
  encodeForwardCenterAdjustment,
  resolveWaypoints,
  routeDragPolicy,
  routeDragSpine,
  SPINE_HIT_THICKNESS,
  smoothStepCenters,
} from './routedPath.ts';

type RoutableEdgeData = {
  waypoints?: Position[];
};

function spineHitBox(segment: DragSpineSegment): {
  cx: number;
  cy: number;
  width: number;
  height: number;
} {
  const cx = (segment.from.x + segment.to.x) / 2;
  const cy = (segment.from.y + segment.to.y) / 2;
  const along =
    segment.orientation === 'horizontal'
      ? Math.abs(segment.to.x - segment.from.x)
      : Math.abs(segment.to.y - segment.from.y);
  const length = Math.max(along, SPINE_HIT_THICKNESS);
  return {
    cx,
    cy,
    width: segment.orientation === 'horizontal' ? length : SPINE_HIT_THICKNESS,
    height: segment.orientation === 'horizontal' ? SPINE_HIT_THICKNESS : length,
  };
}

function storedWaypointsMatch(a: Position[], b: Position[]): boolean {
  if (a.length !== b.length) return false;
  return a.every((p, i) => {
    const q = b[i];
    return q !== undefined && p.x === q.x && p.y === q.y;
  });
}

export function RoutableEdge({
  id,
  sourceX,
  sourceY,
  targetX,
  targetY,
  sourcePosition,
  targetPosition,
  data,
  selected,
  markerEnd,
  style,
  label,
  labelStyle,
  labelShowBg = true,
  interactionWidth,
}: EdgeProps) {
  const setRoute = useSetEdgeRoute();
  const { screenToFlowPosition, setEdges, setNodes } = useReactFlow();
  const stored = (data as RoutableEdgeData | undefined)?.waypoints ?? [];
  const [draft, setDraft] = useState<Position[] | null>(null);
  const dragRef = useRef<{
    pointerId: number;
    lockX?: number;
    lockY?: number;
    moved: boolean;
  } | null>(null);
  const dragStartRef = useRef<{ x: number; y: number } | null>(null);
  const pendingCommitRef = useRef<Position[] | null>(null);

  const DRAG_THRESHOLD = 2;

  const dragPolicy = useMemo(
    () => routeDragPolicy(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
  );

  const centerDefaults = useMemo(
    () => smoothStepCenters(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition),
    [sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition],
  );

  const canRoute = Boolean(setRoute) && dragPolicy.mode !== 'none';

  const displayWaypoints = useMemo(() => {
    const raw = draft ?? stored;
    if (draft) return raw;
    return resolveWaypoints(raw, sourceX, sourceY, targetX, targetY, targetPosition);
  }, [draft, stored, sourceX, sourceY, targetX, targetY, targetPosition]);

  const { path, labelX, labelY } = buildRoutedPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    displayWaypoints,
  );

  const dragSpine = useMemo(
    () =>
      routeDragSpine(
        dragPolicy,
        sourceX,
        sourceY,
        targetX,
        targetY,
        sourcePosition,
        targetPosition,
        labelX,
        labelY,
      ),
    [
      dragPolicy,
      labelX,
      labelY,
      sourcePosition,
      sourceX,
      sourceY,
      targetPosition,
      targetX,
      targetY,
    ],
  );

  const selectEdge = useCallback(() => {
    setNodes((nodes) => nodes.map((node) => ({ ...node, selected: false })));
    setEdges((edges) => edges.map((edge) => ({ ...edge, selected: edge.id === id })));
  }, [id, setEdges, setNodes]);

  // Keep draft visuals until Y.Doc echoes the committed encoding (avoids release flash).
  useLayoutEffect(() => {
    const pending = pendingCommitRef.current;
    if (pending === null) return;
    if (storedWaypointsMatch(pending, stored)) {
      pendingCommitRef.current = null;
      setDraft(null);
    }
  }, [stored]);

  const commitRoute = useCallback(
    (points: Position[]) => {
      if (points.length === 0) {
        pendingCommitRef.current = [];
        setRoute?.(id, []);
        return;
      }
      const point = points[0];
      if (!point) return;

      if (dragPolicy.mode === 'u-depth') {
        const encoded = [encodeBackEdgeWaypoint(point, sourceY, targetY)];
        pendingCommitRef.current = encoded;
        setRoute?.(id, encoded);
        return;
      }
      if (dragPolicy.mode === 'axis-center' && dragPolicy.axis) {
        const encoded = [encodeForwardCenterAdjustment(dragPolicy.axis, point, centerDefaults)];
        pendingCommitRef.current = encoded;
        setRoute?.(id, encoded);
      }
    },
    [centerDefaults, dragPolicy, id, setRoute, sourceY, targetY],
  );

  const onSpinePointerDown = useCallback(
    (event: React.PointerEvent) => {
      if (!canRoute) return;
      event.stopPropagation();
      selectEdge();
      (event.currentTarget as HTMLElement).setPointerCapture(event.pointerId);
      dragStartRef.current = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      dragRef.current = {
        pointerId: event.pointerId,
        lockX: dragPolicy.mode === 'u-depth' || dragPolicy.axis === 'y' ? labelX : undefined,
        lockY: dragPolicy.mode === 'axis-center' && dragPolicy.axis === 'x' ? labelY : undefined,
        moved: false,
      };
    },
    [canRoute, dragPolicy, labelX, labelY, screenToFlowPosition, selectEdge],
  );

  const onSpinePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const start = dragStartRef.current;
      if (!drag.moved) {
        if (!start || Math.hypot(pos.x - start.x, pos.y - start.y) < DRAG_THRESHOLD) return;
        drag.moved = true;
      }

      if (dragPolicy.mode === 'u-depth') {
        setDraft([{ x: drag.lockX ?? labelX, y: pos.y }]);
        return;
      }

      if (dragPolicy.mode === 'axis-center' && dragPolicy.axis === 'x') {
        const x = clampAxisCenter(
          pos.x,
          'x',
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        );
        setDraft([{ x, y: drag.lockY ?? labelY }]);
        return;
      }

      if (dragPolicy.mode === 'axis-center' && dragPolicy.axis === 'y') {
        const y = clampAxisCenter(
          pos.y,
          'y',
          sourceX,
          sourceY,
          targetX,
          targetY,
          sourcePosition,
          targetPosition,
        );
        setDraft([{ x: drag.lockX ?? labelX, y }]);
      }
    },
    [
      dragPolicy,
      labelX,
      labelY,
      screenToFlowPosition,
      sourcePosition,
      sourceX,
      sourceY,
      targetPosition,
      targetX,
      targetY,
    ],
  );

  const onSpinePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      dragStartRef.current = null;
      if (!drag.moved) return;
      const final = draft ?? displayWaypoints;
      commitRoute(final);
    },
    [commitRoute, draft, displayWaypoints],
  );

  const onSpineDoubleClick = useCallback((event: React.MouseEvent) => {
    event.preventDefault();
    event.stopPropagation();
  }, []);

  const spineCursor =
    dragPolicy.mode === 'u-depth' || dragPolicy.axis === 'y'
      ? 'cursor-ns-resize'
      : dragPolicy.axis === 'x'
        ? 'cursor-ew-resize'
        : undefined;

  const spineTitle =
    dragPolicy.mode === 'u-depth'
      ? 'Drag to route below'
      : dragPolicy.mode === 'axis-center'
        ? 'Drag to adjust bend'
        : undefined;

  const spineBox = dragSpine ? spineHitBox(dragSpine) : null;

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={style}
        interactionWidth={interactionWidth ?? 20}
      />
      {(canRoute && dragSpine && spineBox) || label ? (
        <EdgeLabelRenderer>
          {canRoute && dragSpine && spineBox && (
            <button
              type="button"
              className={[
                'nodrag nopan pointer-events-auto absolute border-0 bg-transparent p-0',
                spineCursor,
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                transform: `translate(-50%, -50%) translate(${spineBox.cx}px, ${spineBox.cy}px)`,
                width: spineBox.width,
                height: spineBox.height,
              }}
              title={spineTitle}
              aria-label={
                dragPolicy.mode === 'u-depth'
                  ? 'Drag spine vertically to route edge below'
                  : 'Drag spine to adjust edge bend'
              }
              onPointerDown={onSpinePointerDown}
              onPointerMove={onSpinePointerMove}
              onPointerUp={onSpinePointerUp}
              onDoubleClick={onSpineDoubleClick}
            />
          )}
          {label && (
            <div
              className={[
                'nodrag nopan pointer-events-none absolute select-none text-[10px] leading-none',
                labelShowBg !== false &&
                  'rounded-sm bg-[var(--xy-edge-label-background-color,var(--xy-edge-label-background-color-default,#fff))] px-1 py-0.5 shadow-sm dark:bg-zinc-900',
                selected && 'ring-2 ring-violet-300 dark:ring-violet-700',
              ]
                .filter(Boolean)
                .join(' ')}
              style={{
                transform: `translate(-50%, -50%) translate(${labelX}px, ${labelY}px)`,
                color: labelStyle?.color,
                ...labelStyle,
              }}
            >
              {label}
            </div>
          )}
        </EdgeLabelRenderer>
      ) : null}
    </>
  );
}
