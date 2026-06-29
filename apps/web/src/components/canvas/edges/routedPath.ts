import { getSmoothStepPath, Position, type XYPosition } from '@xyflow/react';

/** Build an SVG path through optional waypoints, smoothstep between each segment. */
export function buildRoutedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  waypoints: XYPosition[],
): string {
  if (waypoints.length === 0) {
    const [path] = getSmoothStepPath({
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      borderRadius: 8,
    });
    return path;
  }

  const points: XYPosition[] = [
    { x: sourceX, y: sourceY },
    ...waypoints,
    { x: targetX, y: targetY },
  ];
  const segments: string[] = [];
  for (let i = 0; i < points.length - 1; i++) {
    const from = points[i];
    const to = points[i + 1];
    if (!from || !to) continue;
    const [seg] = getSmoothStepPath({
      sourceX: from.x,
      sourceY: from.y,
      targetX: to.x,
      targetY: to.y,
      sourcePosition: i === 0 ? sourcePosition : Position.Right,
      targetPosition: i === points.length - 2 ? targetPosition : Position.Left,
      borderRadius: 8,
    });
    segments.push(seg);
  }
  return segments.map((seg, i) => (i === 0 ? seg : seg.replace(/^M [^ ]+ [^ ]+ /, ''))).join(' ');
}

/** Midpoint between source and target handles — seed for the first bend handle. */
export function defaultBendHandle(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
): XYPosition {
  return { x: (sourceX + targetX) / 2, y: (sourceY + targetY) / 2 };
}
