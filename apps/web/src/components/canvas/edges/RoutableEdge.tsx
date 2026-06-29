'use client';

import { BaseEdge, EdgeLabelRenderer, type EdgeProps, useReactFlow } from '@xyflow/react';
import { useCallback, useMemo, useRef, useState } from 'react';
import type { Position } from '../ydoc/schema.ts';
import { useSetEdgeRoute } from './edgeRouteContext.tsx';
import { buildRoutedPath, defaultBendHandle } from './routedPath.ts';

type RoutableEdgeData = {
  waypoints?: Position[];
};

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
  labelShowBg,
  interactionWidth,
}: EdgeProps) {
  const setRoute = useSetEdgeRoute();
  const { screenToFlowPosition } = useReactFlow();
  const stored = (data as RoutableEdgeData | undefined)?.waypoints ?? [];
  const [draft, setDraft] = useState<Position[] | null>(null);
  const dragRef = useRef<{ index: number; pointerId: number } | null>(null);

  const waypoints = draft ?? stored;
  const path = buildRoutedPath(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    waypoints,
  );

  const seedHandle = useMemo(
    () => defaultBendHandle(sourceX, sourceY, targetX, targetY),
    [sourceX, sourceY, targetX, targetY],
  );

  const handles: Position[] = useMemo(() => {
    if (waypoints.length > 0) return waypoints;
    if (selected) return [seedHandle];
    return [];
  }, [waypoints, selected, seedHandle]);

  const commitRoute = useCallback(
    (points: Position[]) => {
      setDraft(null);
      setRoute?.(id, points);
    },
    [id, setRoute],
  );

  const onHandlePointerDown = useCallback(
    (index: number, event: React.PointerEvent) => {
      if (!setRoute) return;
      event.stopPropagation();
      (event.target as HTMLElement).setPointerCapture(event.pointerId);
      dragRef.current = { index, pointerId: event.pointerId };
      if (waypoints.length === 0) {
        setDraft([seedHandle]);
      }
    },
    [seedHandle, setRoute, waypoints.length],
  );

  const onHandlePointerMove = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      const pos = screenToFlowPosition({ x: event.clientX, y: event.clientY });
      const base = waypoints.length > 0 ? waypoints : [seedHandle];
      const next = base.map((p, i) => (i === drag.index ? pos : p));
      setDraft(next);
    },
    [screenToFlowPosition, seedHandle, waypoints],
  );

  const onHandlePointerUp = useCallback(
    (event: React.PointerEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pointerId !== event.pointerId) return;
      dragRef.current = null;
      const final = draft ?? waypoints;
      commitRoute(final);
    },
    [commitRoute, draft, waypoints],
  );

  return (
    <>
      <BaseEdge
        path={path}
        markerEnd={markerEnd}
        style={style}
        label={label}
        labelStyle={labelStyle}
        labelShowBg={labelShowBg}
        interactionWidth={interactionWidth ?? 20}
      />
      {selected && setRoute && handles.length > 0 && (
        <EdgeLabelRenderer>
          {handles.map((point, index) => (
            <div
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed waypoint slots per edge
              key={`${id}-wp-${index}`}
              className="nodrag nopan pointer-events-auto absolute h-3 w-3 rounded-full border-2 border-indigo-500 bg-white shadow dark:bg-zinc-900"
              style={{ transform: `translate(-50%, -50%) translate(${point.x}px, ${point.y}px)` }}
              onPointerDown={(e) => onHandlePointerDown(index, e)}
              onPointerMove={onHandlePointerMove}
              onPointerUp={onHandlePointerUp}
            />
          ))}
        </EdgeLabelRenderer>
      )}
    </>
  );
}
