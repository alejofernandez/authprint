import { describe, expect, test } from 'bun:test';
import { Position } from '@xyflow/react';
import {
  buildRoutedPath,
  defaultEdgeLabel,
  encodeBackEdgeWaypoint,
  encodeForwardCenterAdjustment,
  inferHandlePosition,
  isBackEdge,
  resolveWaypoints,
  routeDragPolicy,
  routeDragSpine,
  seedBendHandle,
  smoothStepCenters,
} from './routedPath.ts';

describe('inferHandlePosition', () => {
  test('horizontal segment to the right exits Right / enters Left', () => {
    expect(inferHandlePosition({ x: 0, y: 0 }, { x: 100, y: 0 }, 'source')).toBe(Position.Right);
    expect(inferHandlePosition({ x: 0, y: 0 }, { x: 100, y: 0 }, 'target')).toBe(Position.Left);
  });

  test('vertical segment downward exits Bottom / enters Top', () => {
    expect(inferHandlePosition({ x: 0, y: 0 }, { x: 0, y: 80 }, 'source')).toBe(Position.Bottom);
    expect(inferHandlePosition({ x: 0, y: 0 }, { x: 0, y: 80 }, 'target')).toBe(Position.Top);
  });
});

describe('isBackEdge', () => {
  test('target left of source is a back-edge', () => {
    expect(isBackEdge(400, 100)).toBe(true);
  });
  test('forward edge is not a back-edge', () => {
    expect(isBackEdge(100, 400)).toBe(false);
  });
});

describe('routeDragPolicy', () => {
  test('straight horizontal edge is not draggable', () => {
    expect(routeDragPolicy(400, 200, 700, 200, Position.Right, Position.Left).mode).toBe('none');
  });

  test('vertical L edge is not draggable', () => {
    expect(routeDragPolicy(200, 300, 200, 100, Position.Bottom, Position.Top).mode).toBe('none');
  });

  test('back-edge uses u-depth drag', () => {
    expect(routeDragPolicy(600, 200, 200, 120, Position.Bottom, Position.Left).mode).toBe(
      'u-depth',
    );
  });

  test('offset S edge slides centerX only', () => {
    const policy = routeDragPolicy(400, 220, 700, 180, Position.Right, Position.Left);
    expect(policy).toEqual({ mode: 'axis-center', axis: 'x' });
  });
});

describe('routeDragSpine', () => {
  test('back-edge spine is the full horizontal return leg', () => {
    const policy = routeDragPolicy(600, 200, 200, 120, Position.Bottom, Position.Left);
    const spine = routeDragSpine(
      policy,
      600,
      200,
      200,
      120,
      Position.Bottom,
      Position.Left,
      390,
      220,
    );
    expect(spine?.orientation).toBe('horizontal');
    expect(spine?.from).toEqual({ x: 180, y: 220 });
    expect(spine?.to).toEqual({ x: 600, y: 220 });
  });

  test('S-edge spine is the vertical center segment', () => {
    const policy = routeDragPolicy(400, 220, 700, 180, Position.Right, Position.Left);
    const defaults = smoothStepCenters(400, 220, 700, 180, Position.Right, Position.Left);
    const spine = routeDragSpine(
      policy,
      400,
      220,
      700,
      180,
      Position.Right,
      Position.Left,
      defaults.centerX,
      defaults.centerY,
    );
    expect(spine?.orientation).toBe('vertical');
    expect(spine?.from.x).toBe(spine?.to.x);
  });
});

describe('forward center adjustment', () => {
  test('centerX offset changes path without adding a loop', () => {
    const defaults = smoothStepCenters(400, 220, 700, 180, Position.Right, Position.Left);
    const stored = [encodeForwardCenterAdjustment('x', { x: 520, y: defaults.centerY }, defaults)];
    const routed = buildRoutedPath(400, 220, 700, 180, Position.Right, Position.Left, stored);
    expect(routed.path).toContain('520,220');
    expect(routed.path).not.toBe(
      buildRoutedPath(400, 220, 700, 180, Position.Right, Position.Left, []).path,
    );
  });
});

describe('seedBendHandle', () => {
  test('matches the default edge label anchor', () => {
    const seed = seedBendHandle(400, 80, 150, 40, Position.Bottom, Position.Left);
    const label = defaultEdgeLabel(400, 80, 150, 40, Position.Bottom, Position.Left);
    expect(seed).toEqual({ x: label.labelX, y: label.labelY });
  });
});

describe('resolveWaypoints', () => {
  test('back-edge relative offset follows node vertical move', () => {
    const stored = encodeBackEdgeWaypoint({ x: 999, y: 160 }, 80, 40);
    expect(stored).toEqual({ x: 0, y: 80 });
    const before = resolveWaypoints([stored], 400, 80, 150, 40, Position.Left);
    expect(before[0]?.y).toBe(160);
    const after = resolveWaypoints([stored], 400, 30, 150, 20, Position.Left);
    expect(after[0]?.y).toBe(110);
    expect(after[0]?.x).toBe(265);
  });
});

describe('buildRoutedPath', () => {
  test('empty waypoints matches a single smoothstep segment', () => {
    const { path } = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, []);
    expect(path.startsWith('M')).toBe(true);
    expect(path.length).toBeGreaterThan(10);
  });

  test('empty waypoints returns label coordinates from smoothstep', () => {
    const { labelX, labelY } = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, []);
    expect(Number.isFinite(labelX)).toBe(true);
    expect(Number.isFinite(labelY)).toBe(true);
  });

  test('waypoints change the path d attribute', () => {
    const plain = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, []);
    const routed = buildRoutedPath(400, 80, 150, 40, Position.Bottom, Position.Left, [
      { x: 275, y: 160 },
    ]);
    expect(routed.path).not.toBe(plain.path);
  });

  test('routed back-edge label sits on the return leg, not the default path', () => {
    const unrouted = defaultEdgeLabel(400, 80, 150, 40, Position.Bottom, Position.Left);
    const routed = buildRoutedPath(400, 80, 150, 40, Position.Bottom, Position.Left, [
      { x: 275, y: 160 },
    ]);
    expect(routed.labelY).not.toBe(unrouted.labelY);
    expect(routed.labelY).toBe(160);
    expect(routed.labelX).toBe(265);
  });

  test('long back-edge keeps a straight horizontal spine with rounded corners', () => {
    const spineY = 220;
    const { path } = buildRoutedPath(900, 100, 200, 60, Position.Bottom, Position.Left, [
      { x: 550, y: spineY },
    ]);
    expect(path).toContain('Q');
    expect(path).not.toMatch(/\d 220 M/);
    expect(path).toContain('220');
    // Ends with horizontal entry into the left face (not a vertical spike at targetX).
    expect(path).toMatch(/L200 60$/);
  });
});
