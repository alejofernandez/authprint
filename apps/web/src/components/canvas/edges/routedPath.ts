import { getSmoothStepPath, Position, type XYPosition } from '@xyflow/react';

export type RoutedPath = { path: string; labelX: number; labelY: number };

export const BACK_EDGE_RELATIVE_X = 0;
/** Stored offset from default smoothstep centerY (S-path horizontal spine). */
export const FORWARD_CENTER_Y_MARKER = 1;
/** Stored offset from default smoothstep centerX (S-path vertical spine). */
export const FORWARD_CENTER_X_MARKER = 2;

const SMOOTHSTEP_OFFSET = 20;

const HANDLE_DIRECTIONS: Record<Position, XYPosition> = {
  [Position.Left]: { x: -1, y: 0 },
  [Position.Right]: { x: 1, y: 0 },
  [Position.Top]: { x: 0, y: -1 },
  [Position.Bottom]: { x: 0, y: 1 },
};

export type RouteDragMode = 'none' | 'u-depth' | 'axis-center';

export type RouteDragPolicy = {
  mode: RouteDragMode;
  /** For axis-center: which coordinate of the smoothstep spine may move. */
  axis?: 'x' | 'y';
};

export type SmoothStepCenters = {
  centerX: number;
  centerY: number;
  policy: RouteDragPolicy;
};

/** Full-length segment that accepts route drag pointer events. */
export type DragSpineSegment = {
  from: XYPosition;
  to: XYPosition;
  orientation: 'horizontal' | 'vertical';
};

/** Perpendicular grab thickness for spine hit strips (flow px). */
export const SPINE_HIT_THICKNESS = 24;

function flowDirection(
  source: XYPosition,
  sourcePosition: Position,
  target: XYPosition,
): XYPosition {
  if (sourcePosition === Position.Left || sourcePosition === Position.Right) {
    return source.x < target.x ? { x: 1, y: 0 } : { x: -1, y: 0 };
  }
  return source.y < target.y ? { x: 0, y: 1 } : { x: 0, y: -1 };
}

/** Classify default path topology — drives whether / how the label may be dragged. */
export function routeDragPolicy(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset = SMOOTHSTEP_OFFSET,
): RouteDragPolicy {
  if (isBackEdge(sourceX, targetX)) {
    return { mode: 'u-depth' };
  }

  const sourceDir = HANDLE_DIRECTIONS[sourcePosition];
  const targetDir = HANDLE_DIRECTIONS[targetPosition];
  const sourceGapped = {
    x: sourceX + sourceDir.x * offset,
    y: sourceY + sourceDir.y * offset,
  };
  const targetGapped = {
    x: targetX + targetDir.x * offset,
    y: targetY + targetDir.y * offset,
  };

  if (Math.abs(sourceGapped.y - targetGapped.y) < 4 && sourceDir.y === 0) {
    return { mode: 'none' };
  }
  if (Math.abs(sourceGapped.x - targetGapped.x) < 4 && sourceDir.x === 0) {
    return { mode: 'none' };
  }

  const dir = flowDirection(sourceGapped, sourcePosition, targetGapped);
  const dirAccessor = dir.x !== 0 ? 'x' : 'y';
  const currDir = dir[dirAccessor];

  if (sourceDir[dirAccessor] * targetDir[dirAccessor] !== -1) {
    return { mode: 'none' };
  }

  const verticalSpine =
    sourceDir[dirAccessor] === currDir ? dirAccessor === 'x' : dirAccessor === 'y';
  return { mode: 'axis-center', axis: verticalSpine ? 'x' : 'y' };
}

/** Default smoothstep spine center + drag policy (mirrors @xyflow/system getPoints). */
export function smoothStepCenters(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset = SMOOTHSTEP_OFFSET,
): SmoothStepCenters {
  const policy = routeDragPolicy(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    offset,
  );
  const sourceDir = HANDLE_DIRECTIONS[sourcePosition];
  const targetDir = HANDLE_DIRECTIONS[targetPosition];
  const sourceGapped = {
    x: sourceX + sourceDir.x * offset,
    y: sourceY + sourceDir.y * offset,
  };
  const targetGapped = {
    x: targetX + targetDir.x * offset,
    y: targetY + targetDir.y * offset,
  };
  const dir = flowDirection(sourceGapped, sourcePosition, targetGapped);
  const dirAccessor = dir.x !== 0 ? 'x' : 'y';

  let centerX = (sourceGapped.x + targetGapped.x) / 2;
  let centerY = (sourceGapped.y + targetGapped.y) / 2;
  if (dirAccessor === 'x') {
    centerX = sourceGapped.x + (targetGapped.x - sourceGapped.x) * 0.5;
    centerY = (sourceGapped.y + targetGapped.y) / 2;
  } else {
    centerX = (sourceGapped.x + targetGapped.x) / 2;
    centerY = sourceGapped.y + (targetGapped.y - sourceGapped.y) * 0.5;
  }

  return { centerX, centerY, policy };
}

/** Draggable spine geometry for the current routed label position. */
export function routeDragSpine(
  policy: RouteDragPolicy,
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  spineX: number,
  spineY: number,
): DragSpineSegment | null {
  if (policy.mode === 'none') return null;

  const sourceDir = HANDLE_DIRECTIONS[sourcePosition];
  const targetDir = HANDLE_DIRECTIONS[targetPosition];
  const sourceGapped = {
    x: sourceX + sourceDir.x * SMOOTHSTEP_OFFSET,
    y: sourceY + sourceDir.y * SMOOTHSTEP_OFFSET,
  };
  const targetGapped = {
    x: targetX + targetDir.x * SMOOTHSTEP_OFFSET,
    y: targetY + targetDir.y * SMOOTHSTEP_OFFSET,
  };

  if (policy.mode === 'u-depth') {
    const targetGappedX =
      targetPosition === Position.Left
        ? targetX - SMOOTHSTEP_OFFSET
        : targetPosition === Position.Right
          ? targetX + SMOOTHSTEP_OFFSET
          : targetX;
    return {
      from: { x: Math.min(sourceX, targetGappedX), y: spineY },
      to: { x: Math.max(sourceX, targetGappedX), y: spineY },
      orientation: 'horizontal',
    };
  }

  if (policy.mode === 'axis-center' && policy.axis === 'x') {
    return {
      from: { x: spineX, y: Math.min(sourceGapped.y, targetGapped.y) },
      to: { x: spineX, y: Math.max(sourceGapped.y, targetGapped.y) },
      orientation: 'vertical',
    };
  }

  if (policy.mode === 'axis-center' && policy.axis === 'y') {
    return {
      from: { x: Math.min(sourceGapped.x, targetGapped.x), y: spineY },
      to: { x: Math.max(sourceGapped.x, targetGapped.x), y: spineY },
      orientation: 'horizontal',
    };
  }

  return null;
}

export function clampAxisCenter(
  value: number,
  axis: 'x' | 'y',
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  offset = SMOOTHSTEP_OFFSET,
): number {
  const sourceDir = HANDLE_DIRECTIONS[sourcePosition];
  const targetDir = HANDLE_DIRECTIONS[targetPosition];
  const sourceGapped = {
    x: sourceX + sourceDir.x * offset,
    y: sourceY + sourceDir.y * offset,
  };
  const targetGapped = {
    x: targetX + targetDir.x * offset,
    y: targetY + targetDir.y * offset,
  };
  const min =
    axis === 'x'
      ? Math.min(sourceGapped.x, targetGapped.x)
      : Math.min(sourceGapped.y, targetGapped.y);
  const max =
    axis === 'x'
      ? Math.max(sourceGapped.x, targetGapped.x)
      : Math.max(sourceGapped.y, targetGapped.y);
  return Math.min(max, Math.max(min, value));
}

export function encodeForwardCenterAdjustment(
  axis: 'x' | 'y',
  absolute: XYPosition,
  defaults: SmoothStepCenters,
): XYPosition {
  if (axis === 'x') {
    return { x: FORWARD_CENTER_X_MARKER, y: absolute.x - defaults.centerX };
  }
  return { x: FORWARD_CENTER_Y_MARKER, y: absolute.y - defaults.centerY };
}

function resolveForwardCenter(
  stored: XYPosition[],
  defaults: SmoothStepCenters,
): { centerX?: number; centerY?: number } | null {
  const wp = stored[0];
  if (!wp) return null;
  if (wp.x === FORWARD_CENTER_X_MARKER) {
    return { centerX: defaults.centerX + wp.y };
  }
  if (wp.x === FORWARD_CENTER_Y_MARKER) {
    return { centerY: defaults.centerY + wp.y };
  }
  return null;
}

function isRecognizedWaypoint(wp: XYPosition, backEdge: boolean): boolean {
  if (backEdge) return wp.x === BACK_EDGE_RELATIVE_X;
  return wp.x === FORWARD_CENTER_X_MARKER || wp.x === FORWARD_CENTER_Y_MARKER;
}

/** Infer which side of a node a segment should attach to from geometry. */
export function inferHandlePosition(
  from: XYPosition,
  to: XYPosition,
  end: 'source' | 'target',
): Position {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    if (end === 'source') return dx >= 0 ? Position.Right : Position.Left;
    return dx >= 0 ? Position.Left : Position.Right;
  }
  if (end === 'source') return dy >= 0 ? Position.Bottom : Position.Top;
  return dy >= 0 ? Position.Top : Position.Bottom;
}

/** Default unrouted label anchor (stable trigger label placement). */
export function defaultEdgeLabel(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
): { labelX: number; labelY: number } {
  const [, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
  });
  return { labelX, labelY };
}

/** True when the edge runs mostly backward (retry / error loops). */
export function isBackEdge(sourceX: number, targetX: number): boolean {
  return targetX < sourceX - 20;
}

/**
 * Persist a back-edge waypoint as a depth offset (y) below the lower endpoint.
 * X is always recomputed at render so the loop tracks node moves.
 */
export function encodeBackEdgeWaypoint(
  absolute: XYPosition,
  sourceY: number,
  targetY: number,
): XYPosition {
  return {
    x: BACK_EDGE_RELATIVE_X,
    y: absolute.y - Math.max(sourceY, targetY),
  };
}

/** Turn stored layout waypoints into absolute canvas coordinates. */
export function resolveWaypoints(
  stored: XYPosition[],
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  targetPosition: Position = Position.Left,
): XYPosition[] {
  if (stored.length === 0) return stored;

  if (isBackEdge(sourceX, targetX)) {
    const wp = stored[0];
    if (wp && !isRecognizedWaypoint(wp, true)) return [];

    const baseY = Math.max(sourceY, targetY);
    const anchorX = backEdgeSpineAnchorX(sourceX, targetX, targetPosition);

    return stored.map((point) => {
      if (point.x === BACK_EDGE_RELATIVE_X) {
        return { x: anchorX, y: baseY + point.y };
      }
      const dy = Math.max(point.y - baseY, 24);
      return { x: anchorX, y: baseY + dy };
    });
  }

  const wp = stored[0];
  if (wp && !isRecognizedWaypoint(wp, false)) return [];
  return stored;
}

/**
 * Initial drag anchor when no waypoints exist yet — same point as the edge label.
 */
export function seedBendHandle(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
): XYPosition {
  const { labelX, labelY } = defaultEdgeLabel(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );
  return { x: labelX, y: labelY };
}

function smoothStepRoutedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  center?: { centerX?: number; centerY?: number },
): RoutedPath {
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    borderRadius: 8,
    offset: SMOOTHSTEP_OFFSET,
    ...center,
  });
  return { path, labelX, labelY };
}

/** Euclidean distance — used by corner rounding (mirrors @xyflow/system). */
function distance(a: XYPosition, b: XYPosition): number {
  return Math.hypot(a.x - b.x, a.y - b.y);
}

/** Rounded corner between orthogonal segments (mirrors @xyflow/system getBend). */
function getBend(a: XYPosition, b: XYPosition, c: XYPosition, size: number): string {
  const bendSize = Math.min(distance(a, b) / 2, distance(b, c) / 2, size);
  const { x, y } = b;
  if ((a.x === x && x === c.x) || (a.y === y && y === c.y)) {
    return `L${x} ${y}`;
  }
  if (a.y === y) {
    const xDir = a.x < c.x ? -1 : 1;
    const yDir = a.y < c.y ? 1 : -1;
    return `L ${x + bendSize * xDir},${y}Q ${x},${y} ${x},${y + bendSize * yDir}`;
  }
  const xDir = a.x < c.x ? 1 : -1;
  const yDir = a.y < c.y ? -1 : 1;
  return `L ${x},${y + bendSize * yDir}Q ${x},${y} ${x + bendSize * xDir},${y}`;
}

/** X anchor for back-edge spine / label — midpoint of the horizontal return leg. */
export function backEdgeSpineAnchorX(
  sourceX: number,
  targetX: number,
  targetPosition: Position,
): number {
  const targetGappedX =
    targetPosition === Position.Left
      ? targetX - SMOOTHSTEP_OFFSET
      : targetPosition === Position.Right
        ? targetX + SMOOTHSTEP_OFFSET
        : targetX;
  return (sourceX + targetGappedX) / 2;
}

/** Polyline → smoothstep path with rounded corners at each bend. */
function buildRoundedPolylinePath(points: XYPosition[], borderRadius = 8): string {
  if (points.length < 2) return '';
  const first = points[0];
  if (!first) return '';
  let path = `M${first.x} ${first.y}`;
  for (let i = 1; i < points.length - 1; i++) {
    const prev = points[i - 1];
    const curr = points[i];
    const next = points[i + 1];
    if (!prev || !curr || !next) continue;
    path += getBend(prev, curr, next, borderRadius);
  }
  const last = points[points.length - 1];
  if (last) path += `L${last.x} ${last.y}`;
  return path;
}

/**
 * U-shaped back-edge with xyflow-style rounded corners and correct Left-target entry.
 * Spine depth is the horizontal run's Y; approach mirrors default smoothstep geometry.
 */
function buildBackEdgeRoutedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  spineY: number,
): RoutedPath {
  const offset = SMOOTHSTEP_OFFSET;

  if (sourcePosition === Position.Bottom && targetPosition === Position.Left) {
    const targetGappedX = targetX - offset;
    const anchorX = (sourceX + targetGappedX) / 2;
    const points: XYPosition[] = [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: spineY },
      { x: targetGappedX, y: spineY },
      { x: targetGappedX, y: targetY },
      { x: targetX, y: targetY },
    ];
    return {
      path: buildRoundedPolylinePath(points),
      labelX: anchorX,
      labelY: spineY,
    };
  }

  if (sourcePosition === Position.Bottom && targetPosition === Position.Right) {
    const targetGappedX = targetX + offset;
    const anchorX = (sourceX + targetGappedX) / 2;
    const points: XYPosition[] = [
      { x: sourceX, y: sourceY },
      { x: sourceX, y: spineY },
      { x: targetGappedX, y: spineY },
      { x: targetGappedX, y: targetY },
      { x: targetX, y: targetY },
    ];
    return {
      path: buildRoundedPolylinePath(points),
      labelX: anchorX,
      labelY: spineY,
    };
  }
  const [path, labelX, labelY] = getSmoothStepPath({
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
    centerY: spineY,
    borderRadius: 8,
    offset,
  });
  return { path, labelX, labelY };
}

/** Build an SVG path through optional route adjustments. */
export function buildRoutedPath(
  sourceX: number,
  sourceY: number,
  targetX: number,
  targetY: number,
  sourcePosition: Position,
  targetPosition: Position,
  waypoints: XYPosition[],
): RoutedPath {
  const policy = routeDragPolicy(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );
  const defaults = smoothStepCenters(
    sourceX,
    sourceY,
    targetX,
    targetY,
    sourcePosition,
    targetPosition,
  );

  if (waypoints.length === 0) {
    return smoothStepRoutedPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition);
  }

  const wp = waypoints[0];
  if (!wp) {
    return smoothStepRoutedPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition);
  }

  if (policy.mode === 'u-depth' && isBackEdge(sourceX, targetX)) {
    return buildBackEdgeRoutedPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      wp.y,
    );
  }

  const encodedCenter = resolveForwardCenter(waypoints, defaults);
  if (encodedCenter) {
    return smoothStepRoutedPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      encodedCenter,
    );
  }

  if (policy.mode === 'axis-center' && policy.axis === 'x') {
    return smoothStepRoutedPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      { centerX: wp.x },
    );
  }

  if (policy.mode === 'axis-center' && policy.axis === 'y') {
    return smoothStepRoutedPath(
      sourceX,
      sourceY,
      targetX,
      targetY,
      sourcePosition,
      targetPosition,
      { centerY: wp.y },
    );
  }

  return smoothStepRoutedPath(sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition);
}
