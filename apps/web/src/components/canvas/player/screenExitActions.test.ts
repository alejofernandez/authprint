import { describe, expect, test } from 'bun:test';
import { fixtureRecordFlow, fixtureScreenMockup } from './playerFixtures.ts';
import { actionExternalResults, screenExitActions } from './screenExitActions.ts';

describe('screenExitActions', () => {
  test('collects unique interaction actions from outgoing edges', () => {
    const actions = screenExitActions(fixtureRecordFlow, fixtureScreenMockup.id);
    expect(actions.map((a) => a.actionId).sort()).toEqual(['back', 'forgot-password', 'submit']);
    expect(actions.find((a) => a.actionId === 'submit')?.label).toBe('submit');
  });

  test('returns empty for unknown screen id', () => {
    expect(screenExitActions(fixtureRecordFlow, 'missing')).toEqual([]);
  });
});

describe('actionExternalResults', () => {
  test('offers only results backed by an outgoing edge', () => {
    expect(actionExternalResults(fixtureRecordFlow, 'a1', 'action')).toEqual(['success', 'error']);
  });

  test('external results follow the declared edges', () => {
    expect(actionExternalResults(fixtureRecordFlow, 'x1', 'external')).toEqual([
      'success',
      'error',
      'denied',
      'cancelled',
    ]);
  });

  test('node without result edges offers nothing', () => {
    expect(actionExternalResults(fixtureRecordFlow, 's1', 'action')).toEqual([]);
  });
});
