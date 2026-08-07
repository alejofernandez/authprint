import { describe, expect, test } from 'bun:test';
import type { ScreenNode } from '@authprint/dsl';
import {
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
    expect(plan!.fillsFields).toBe(true);
    expect(plan!.ops.filter((o) => o.kind === 'fill')).toHaveLength(2);
    expect(plan!.ops.some((o) => o.kind === 'click')).toBe(true);
    expect(plan!.totalMs).toBe(
      FILM_MOVE_MS * 3 + FILM_FILL_MS * 2 + FILM_CLICK_MS + FILM_SETTLE_MS,
    );
  });

  test('alternate exit skips fill', () => {
    expect(isPrimaryScreenExit('forgot-password')).toBe(false);
    const plan = planInteractionFilm(
      { ...passwordScreen, traits: ['forgot-password-link'] },
      'forgot-password',
    );
    expect(plan!.fillsFields).toBe(false);
    expect(plan!.ops.filter((o) => o.kind === 'fill')).toHaveLength(0);
    expect(plan!.ops.filter((o) => o.kind === 'move')).toHaveLength(1);
  });

  test('null exit yields no plan', () => {
    expect(planInteractionFilm(passwordScreen, null)).toBeNull();
  });
});

describe('filmClockAt', () => {
  test('advances through ops and reports done', () => {
    const plan = planInteractionFilm(passwordScreen, 'submit')!;
    const start = filmClockAt(plan.ops, 0);
    expect(start.done).toBe(false);
    expect(start.opIndex).toBe(0);

    const midFill = filmClockAt(plan.ops, FILM_MOVE_MS + FILM_FILL_MS / 2);
    expect(midFill.filling?.fieldName).toBe('email');
    expect(midFill.filledFields.size).toBe(0);

    const afterFirst = filmClockAt(plan.ops, FILM_MOVE_MS + FILM_FILL_MS);
    expect(afterFirst.filledFields.has('email')).toBe(true);

    const end = filmClockAt(plan.ops, plan.totalMs);
    expect(end.done).toBe(true);
    expect(end.filledFields.has('password')).toBe(true);
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
