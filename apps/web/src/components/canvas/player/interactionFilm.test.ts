import { describe, expect, test } from 'bun:test';
import type { ScreenNode } from '@authprint/dsl';
import {
  FILM_ALT_CLICK_MS,
  FILM_ALT_MOVE_MS,
  FILM_ALT_SETTLE_MS,
  FILM_CLICK_MS,
  FILM_FILL_MS,
  FILM_MOVE_MS,
  FILM_SETTLE_MS,
  filmClockAt,
  inventFieldValue,
  isPrimaryScreenExit,
  planInteractionFilm,
  visibleFillValue,
} from './interactionFilm.ts';

const passwordScreen: ScreenNode = {
  type: 'screen',
  id: 's1',
  name: 'Sign in',
  kind: 'password',
  traits: [],
  fields: [
    { name: 'email', type: 'email', required: true },
    { name: 'password', type: 'password', required: true },
  ],
};

describe('inventFieldValue', () => {
  test('infers from type and name', () => {
    expect(inventFieldValue({ name: 'email', type: 'email', required: true })).toBe(
      'alex@example.com',
    );
    expect(inventFieldValue({ name: 'password', type: 'password', required: true })).toBe(
      '••••••••',
    );
    expect(inventFieldValue({ name: 'date_of_birth', type: 'text', required: false })).toBe(
      '1990-04-12',
    );
    expect(inventFieldValue({ name: 'remember', type: 'checkbox', required: false })).toBe(true);
  });
});

describe('planInteractionFilm', () => {
  test('primary exit fills fields then clicks', () => {
    expect(isPrimaryScreenExit('submit')).toBe(true);
    const plan = planInteractionFilm(passwordScreen, 'submit');
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.fillsFields).toBe(true);
    expect(plan.ops.filter((o) => o.kind === 'fill')).toHaveLength(2);
    expect(plan.ops.some((o) => o.kind === 'click')).toBe(true);
    expect(plan.totalMs).toBe(FILM_MOVE_MS * 3 + FILM_FILL_MS * 2 + FILM_CLICK_MS + FILM_SETTLE_MS);
  });

  test('alternate exit skips fill', () => {
    expect(isPrimaryScreenExit('forgot-password')).toBe(false);
    const plan = planInteractionFilm(
      { ...passwordScreen, traits: ['forgot-password-link'] },
      'forgot-password',
    );
    expect(plan).not.toBeNull();
    if (!plan) return;
    expect(plan.fillsFields).toBe(false);
    expect(plan.ops.filter((o) => o.kind === 'fill')).toHaveLength(0);
    expect(plan.ops.filter((o) => o.kind === 'move')).toHaveLength(1);
    expect(plan.totalMs).toBe(FILM_ALT_MOVE_MS + FILM_ALT_CLICK_MS + FILM_ALT_SETTLE_MS);
    const move = plan.ops.find((o) => o.kind === 'move');
    expect(move?.durationMs).toBe(FILM_ALT_MOVE_MS);
  });

  test('secondary callout exits get unique film targets per action', () => {
    const otpScreen: ScreenNode = {
      type: 'screen',
      id: 'otp',
      name: 'Enter your code',
      kind: 'otp',
      traits: [],
      fields: [{ name: 'code', type: 'otp', required: true }],
    };
    const usePassword = planInteractionFilm(otpScreen, 'use-password');
    const resend = planInteractionFilm(otpScreen, 'resend-code');
    expect(usePassword?.actionTargetId).toBe('action:secondary:use-password');
    expect(resend?.actionTargetId).toBe('action:secondary:resend-code');
    expect(usePassword?.actionTargetId).not.toBe(resend?.actionTargetId);
  });

  test('null exit yields no plan', () => {
    expect(planInteractionFilm(passwordScreen, null)).toBeNull();
  });
});

describe('filmClockAt', () => {
  test('advances through ops and reports done', () => {
    const plan = planInteractionFilm(passwordScreen, 'submit');
    expect(plan).not.toBeNull();
    if (!plan) return;
    const start = filmClockAt(plan.ops, 0);
    expect(start.done).toBe(false);
    expect(start.opIndex).toBe(0);
    expect(start.moveProgress).toBe(0);

    const midMove = filmClockAt(plan.ops, FILM_MOVE_MS / 2);
    expect(midMove.moveProgress).toBeCloseTo(0.5);
    expect(midMove.filling).toBeNull();

    const midFill = filmClockAt(plan.ops, FILM_MOVE_MS + FILM_FILL_MS / 2);
    expect(midFill.filling?.fieldName).toBe('email');
    expect(midFill.filledFields.size).toBe(0);
    expect(midFill.moveProgress).toBeNull();

    const afterFirst = filmClockAt(plan.ops, FILM_MOVE_MS + FILM_FILL_MS);
    expect(afterFirst.filledFields.has('email')).toBe(true);

    const end = filmClockAt(plan.ops, plan.totalMs);
    expect(end.done).toBe(true);
    expect(end.filledFields.has('password')).toBe(true);
    expect(end.moveProgress).toBeNull();
  });
});

describe('visibleFillValue', () => {
  test('typewrites plain text and progressive dots for passwords', () => {
    const email = { name: 'email', type: 'email', required: true };
    expect(visibleFillValue(email, 'alex@example.com', 0.5)).toBe('alex@exa');
    const password = { name: 'password', type: 'password', required: true };
    expect(visibleFillValue(password, '••••••••', 0.5)).toBe('••••');
  });
});
