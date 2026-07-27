import { describe, expect, test } from 'bun:test';
import {
  defaultScreenSourceSideForAction,
  screenActionAllowedOnSide,
  screenInteractionSideTier,
} from './screenInteractionSides.ts';

describe('screen interaction side tiers', () => {
  test('primary actions exit right only', () => {
    for (const action of ['submit', 'accept'] as const) {
      expect(screenInteractionSideTier(action)).toBe('primary');
      expect(defaultScreenSourceSideForAction(action)).toBe('right');
      expect(screenActionAllowedOnSide(action, 'right')).toBe(true);
      expect(screenActionAllowedOnSide(action, 'bottom')).toBe(false);
    }
  });

  test('retreat actions exit bottom only', () => {
    for (const action of ['back', 'cancel', 'decline'] as const) {
      expect(screenInteractionSideTier(action)).toBe('retreat');
      expect(defaultScreenSourceSideForAction(action)).toBe('bottom');
      expect(screenActionAllowedOnSide(action, 'bottom')).toBe(true);
      expect(screenActionAllowedOnSide(action, 'right')).toBe(false);
    }
  });

  test('auxiliary built-ins and custom labels are flexible on both sides', () => {
    for (const action of [
      'resend-code',
      'forgot-password',
      'try-another-method',
      'sign-up',
      'sign-in',
      'skip',
      'link-clicked',
    ] as const) {
      expect(screenInteractionSideTier(action)).toBe('flexible');
      expect(defaultScreenSourceSideForAction(action)).toBe('right');
      expect(screenActionAllowedOnSide(action, 'right')).toBe(true);
      expect(screenActionAllowedOnSide(action, 'bottom')).toBe(true);
    }
  });

  test('flexible actions balance to the other side when preferred is crowded', () => {
    expect(defaultScreenSourceSideForAction('resend-code', { right: 2, bottom: 0 })).toBe('bottom');
    expect(defaultScreenSourceSideForAction('resend-code', { right: 1, bottom: 0 })).toBe('right');
    // Primary/retreat ignore crowding.
    expect(defaultScreenSourceSideForAction('submit', { right: 5, bottom: 0 })).toBe('right');
    expect(defaultScreenSourceSideForAction('back', { right: 0, bottom: 5 })).toBe('bottom');
  });
});
