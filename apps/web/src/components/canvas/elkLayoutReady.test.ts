import { describe, expect, test } from 'bun:test';
import { elkLayoutReady } from './elkLayoutReady.ts';

describe('elkLayoutReady', () => {
  test('all nodes placed via layout map → empty object, not null', () => {
    expect(elkLayoutReady(null, '')).toEqual({});
  });

  test('unplaced nodes and no elk yet → null (canvas waits)', () => {
    expect(elkLayoutReady(null, 'screen-a')).toBeNull();
  });

  test('elk resolved → pass through positions', () => {
    const positions = { entry: { x: 0, y: 0 } };
    expect(elkLayoutReady(positions, '')).toBe(positions);
    expect(elkLayoutReady(positions, 'screen-a')).toBe(positions);
  });
});
