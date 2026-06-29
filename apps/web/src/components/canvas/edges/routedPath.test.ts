import { describe, expect, test } from 'bun:test';
import { Position } from '@xyflow/react';
import { buildRoutedPath } from './routedPath.ts';

describe('buildRoutedPath', () => {
  test('empty waypoints matches a single smoothstep segment', () => {
    const plain = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, []);
    expect(plain.startsWith('M')).toBe(true);
    expect(plain.length).toBeGreaterThan(10);
  });

  test('waypoints change the path d attribute', () => {
    const plain = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, []);
    const routed = buildRoutedPath(0, 0, 100, 50, Position.Right, Position.Left, [
      { x: 50, y: 80 },
    ]);
    expect(routed).not.toBe(plain);
  });
});
