import { describe, expect, test } from 'bun:test';
import { DSL_VERSION } from './index.ts';

describe('@authprint/dsl skeleton', () => {
  test('exports DSL_VERSION', () => {
    expect(DSL_VERSION).toBe('0.0.0');
  });
});
