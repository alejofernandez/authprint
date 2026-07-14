import { describe, expect, test } from 'bun:test';
import { fixtureRecordFlow, fixtureScreenMockup } from './playerFixtures.ts';
import { screenExitActions } from './screenExitActions.ts';

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
