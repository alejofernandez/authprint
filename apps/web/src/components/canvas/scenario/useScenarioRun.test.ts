import { describe, expect, test } from 'bun:test';
import { clampStepIndex } from './useScenarioRun.ts';

// The step cursor's boundary behavior — the rest of useScenarioRun is React
// state wiring (no hook-test tooling in the repo), so the clamp is the piece
// worth pinning: step/back never run off either end of the trace.
describe('clampStepIndex', () => {
  test('clamps below zero to the start', () => {
    expect(clampStepIndex(-1, 5)).toBe(0);
  });
  test('clamps past the end to the last index', () => {
    expect(clampStepIndex(10, 5)).toBe(4);
  });
  test('passes an in-range index through', () => {
    expect(clampStepIndex(2, 5)).toBe(2);
  });
  test('an empty trace stays at 0', () => {
    expect(clampStepIndex(3, 0)).toBe(0);
  });
});
