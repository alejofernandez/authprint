import type { Field, ScreenNode } from '@authprint/dsl';
import {
  resolveScreenActionHighlightTarget,
  type ScreenActionHighlightTarget,
} from '../nodes/screen/screenActionHighlight.tsx';
import { screenInteractionSideTier } from '../screenInteractionSides.ts';

/** Per-operation timings for the play-mode interaction film (FS-01). */
export const FILM_MOVE_MS = 750;
export const FILM_FILL_MS = 500;
export const FILM_CLICK_MS = 450;
export const FILM_SETTLE_MS = 250;
/** Alternate exits are a single move+click — slightly slower so they don't flash by. */
export const FILM_ALT_MOVE_MS = 1100;
export const FILM_ALT_CLICK_MS = 550;
export const FILM_ALT_SETTLE_MS = 350;

const MASKED_TYPES = new Set(['password', 'new-password', 'confirm-password']);

export type FilmOp =
  | { kind: 'move'; targetId: string; durationMs: number }
  | { kind: 'fill'; fieldName: string; value: string | boolean; durationMs: number }
  | { kind: 'click'; targetId: string; durationMs: number }
  | { kind: 'settle'; durationMs: number };

export type InteractionFilmPlan = {
  ops: FilmOp[];
  totalMs: number;
  /** Primary exits walk fields; alternate exits skip straight to the action. */
  fillsFields: boolean;
  actionTargetId: string;
  /** Invented values keyed by field name (only for fields that get filled). */
  fieldValues: Record<string, string | boolean>;
};

export function isPrimaryScreenExit(action: string): boolean {
  return screenInteractionSideTier(action) === 'primary';
}

/** Fields the imaginary user types into (not passkey buttons / pure chrome). */
export function isFillableField(field: Field): boolean {
  return field.type !== 'passkey';
}

export function inventFieldValue(field: Field): string | boolean {
  const name = field.name.toLowerCase();
  const type = field.type;

  if (type === 'checkbox') return true;
  if (MASKED_TYPES.has(type)) return '••••••••';
  if (type === 'otp' || name.includes('otp') || name.includes('code')) return '482913';
  if (type === 'email' || name.includes('email')) return 'alex@example.com';
  if (type === 'phone' || name.includes('phone') || name.includes('mobile')) return '+1 555 0100';
  if (type === 'date' || name.includes('birth') || name.includes('dob')) return '1990-04-12';
  if (type === 'number' || name.includes('age') || name.includes('count')) return '32';
  if (name.includes('last') || name.includes('surname') || name.includes('family')) return 'Rivera';
  if (name.includes('first') || name === 'name' || name.includes('full')) return 'Alex';
  if (
    type === 'identifier' ||
    name.includes('user') ||
    name.includes('login') ||
    name.includes('identifier')
  ) {
    return 'alex.rivera';
  }
  if (name.includes('company') || name.includes('org')) return 'Acme';
  return 'Alex';
}

export function filmTargetIdForField(fieldName: string): string {
  return `field:${fieldName}`;
}

export function filmTargetIdForHighlight(
  target: ScreenActionHighlightTarget,
  action: string,
): string {
  if (target === 'social-action') return `action:social:${action}`;
  if (target === 'passkey-field') return `action:passkey-field`;
  // Flexible/retreat exits often share the same highlight *kind* (`callout` /
  // `retreat`) while rendering as distinct secondary links. Include the action
  // id so the film cursor lands on the highlighted link, not the first one.
  if (target === 'callout' || target === 'retreat') return `action:secondary:${action}`;
  return `action:${target}`;
}

export function actionFilmTargetId(node: ScreenNode, action: string): string {
  const target = resolveScreenActionHighlightTarget(action, node.traits, node.fields, node.kind);
  return filmTargetIdForHighlight(target, action);
}

/**
 * Build the play-mode interaction film for a Screen step.
 * Primary recorded exits fill fields then click; alternates click only.
 */
export function planInteractionFilm(
  node: ScreenNode,
  exitActionId: string | null,
): InteractionFilmPlan | null {
  if (!exitActionId) return null;

  const fillsFields = isPrimaryScreenExit(exitActionId);
  const actionTargetId = actionFilmTargetId(node, exitActionId);
  const fieldValues: Record<string, string | boolean> = {};
  const ops: FilmOp[] = [];

  if (fillsFields) {
    for (const field of node.fields) {
      if (!isFillableField(field)) continue;
      const value = inventFieldValue(field);
      fieldValues[field.name] = value;
      ops.push({
        kind: 'move',
        targetId: filmTargetIdForField(field.name),
        durationMs: FILM_MOVE_MS,
      });
      ops.push({
        kind: 'fill',
        fieldName: field.name,
        value,
        durationMs: FILM_FILL_MS,
      });
    }
  }

  const moveMs = fillsFields ? FILM_MOVE_MS : FILM_ALT_MOVE_MS;
  const clickMs = fillsFields ? FILM_CLICK_MS : FILM_ALT_CLICK_MS;
  const settleMs = fillsFields ? FILM_SETTLE_MS : FILM_ALT_SETTLE_MS;
  ops.push({ kind: 'move', targetId: actionTargetId, durationMs: moveMs });
  ops.push({ kind: 'click', targetId: actionTargetId, durationMs: clickMs });
  ops.push({ kind: 'settle', durationMs: settleMs });

  const totalMs = ops.reduce((sum, op) => sum + op.durationMs, 0);
  return { ops, totalMs, fillsFields, actionTargetId, fieldValues };
}

export type FilmClockState = {
  opIndex: number;
  opProgress: number; // 0..1 within current op
  done: boolean;
  /** Field names that are fully filled. */
  filledFields: ReadonlySet<string>;
  /** Field currently being filled, with 0..1 type progress. */
  filling: { fieldName: string; progress: number } | null;
  cursorTargetId: string | null;
  clickingTargetId: string | null;
  /** 0..1 while a move op is in progress; null otherwise (sit on target). */
  moveProgress: number | null;
};

export function filmClockAt(ops: readonly FilmOp[], elapsedMs: number): FilmClockState {
  if (ops.length === 0) {
    return {
      opIndex: 0,
      opProgress: 1,
      done: true,
      filledFields: new Set(),
      filling: null,
      cursorTargetId: null,
      clickingTargetId: null,
      moveProgress: null,
    };
  }

  const filledFields = new Set<string>();
  let cursorTargetId: string | null = null;
  let remaining = Math.max(0, elapsedMs);

  for (let i = 0; i < ops.length; i++) {
    const op = ops[i];
    if (!op) break;
    if (remaining < op.durationMs) {
      const opProgress = op.durationMs === 0 ? 1 : remaining / op.durationMs;
      let filling: FilmClockState['filling'] = null;
      let clickingTargetId: string | null = null;
      let moveProgress: number | null = null;
      if (op.kind === 'move') {
        cursorTargetId = op.targetId;
        moveProgress = opProgress;
      }
      if (op.kind === 'fill') {
        filling = { fieldName: op.fieldName, progress: opProgress };
        cursorTargetId = filmTargetIdForField(op.fieldName);
      }
      if (op.kind === 'click') {
        clickingTargetId = op.targetId;
        cursorTargetId = op.targetId;
      }
      // settle: keep cursor on the last move/click target
      return {
        opIndex: i,
        opProgress,
        done: false,
        filledFields,
        filling,
        cursorTargetId,
        clickingTargetId,
        moveProgress,
      };
    }
    remaining -= op.durationMs;
    if (op.kind === 'fill') filledFields.add(op.fieldName);
    if (op.kind === 'move' || op.kind === 'click') cursorTargetId = op.targetId;
  }

  return {
    opIndex: ops.length - 1,
    opProgress: 1,
    done: true,
    filledFields,
    filling: null,
    cursorTargetId,
    clickingTargetId: null,
    moveProgress: null,
  };
}

/** Visible string for a field mid-fill (typewriter for text, progressive dots for passwords). */
export function visibleFillValue(
  field: Field,
  full: string | boolean,
  progress: number,
): string | boolean {
  if (typeof full === 'boolean') return progress >= 0.5 ? full : false;
  if (MASKED_TYPES.has(field.type)) {
    const n = Math.max(1, Math.ceil(full.length * Math.min(1, Math.max(0, progress))));
    return '•'.repeat(n);
  }
  if (field.type === 'otp') {
    const n = Math.max(0, Math.ceil(full.length * Math.min(1, Math.max(0, progress))));
    return full.slice(0, n);
  }
  const n = Math.max(0, Math.floor(full.length * Math.min(1, Math.max(0, progress))));
  return full.slice(0, n);
}
