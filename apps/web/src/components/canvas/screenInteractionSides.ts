// ─── Screen interaction side tiers (US-114) ─────────────────────────────────
// Editor placement policy, deliberately NOT in @authprint/dsl: which side an
// action exits is view convention (Principle 2), not flow semantics.

/** Screen exit side for interaction edges (canvas maps these to handles). */
export type ScreenSourceSide = 'right' | 'bottom';

const PRIMARY_SCREEN_ACTIONS = new Set<string>(['submit', 'accept']);
const RETREAT_SCREEN_ACTIONS = new Set<string>(['back', 'cancel', 'decline']);

export type ScreenInteractionSideTier = 'primary' | 'retreat' | 'flexible';

/** Classify a screen interaction label for handle-side rules in the editor. */
export function screenInteractionSideTier(action: string): ScreenInteractionSideTier {
  if (PRIMARY_SCREEN_ACTIONS.has(action)) return 'primary';
  if (RETREAT_SCREEN_ACTIONS.has(action)) return 'retreat';
  return 'flexible';
}

/** Default exit side for an interaction (primary + flexible → right; retreat → bottom). */
export function defaultScreenSourceSideForAction(action: string): ScreenSourceSide {
  return screenInteractionSideTier(action) === 'retreat' ? 'bottom' : 'right';
}

/** Whether an interaction may leave from the given side (editor convention). */
export function screenActionAllowedOnSide(action: string, side: ScreenSourceSide): boolean {
  const tier = screenInteractionSideTier(action);
  if (tier === 'primary') return side === 'right';
  if (tier === 'retreat') return side === 'bottom';
  return true;
}
