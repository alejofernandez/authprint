import type { Field, ScreenNode, TraitId } from '@authprint/dsl';
import { EQUIVALENT_TRAIT_ACTION, isSocialAction } from '@authprint/dsl';
import type { ReactNode } from 'react';
import { screenInteractionSideTier } from '../../screenInteractionSides.ts';
import { humanize } from './screenCopy.ts';

/** Which on-screen affordance corresponds to the next script action. */
export type ScreenActionHighlightTarget =
  | 'primary-cta'
  | 'forgot-password-link'
  | 'alternative-method-link'
  | 'social-login-buttons'
  | 'social-action'
  | 'passkey-promotion'
  | 'passkey-field'
  | 'retreat'
  | 'callout';

const TRAIT_TARGETS = new Set<ScreenActionHighlightTarget>([
  'forgot-password-link',
  'alternative-method-link',
  'social-login-buttons',
  'passkey-promotion',
]);

// Derived from the DSL's pair table rather than restated, so adding a pair there
// teaches the player's highlight about it too. Restating it is how the passkey
// pair ended up known to the renderer and invisible to the highlight (UF-049).
const ACTION_TO_TRAIT: Partial<Record<string, TraitId>> = Object.fromEntries(
  Object.entries(EQUIVALENT_TRAIT_ACTION).map(([trait, action]) => [action, trait as TraitId]),
);

export const PLAYER_ACTION_HIGHLIGHT_CLASS =
  'rounded-md ring-2 ring-accent-primary-border ring-offset-2 ring-offset-white motion-reduce:transition-none transition-shadow duration-[var(--duration-fast)] flow-dark:ring-offset-zinc-900';

export function actionHighlightLabel(action: string, exitLabel?: string | null): string {
  return exitLabel ?? humanize(action);
}

export function resolveScreenActionHighlightTarget(
  action: string,
  traits: readonly TraitId[],
  fields: readonly Field[],
  kind: string,
): ScreenActionHighlightTarget {
  const mappedTrait = ACTION_TO_TRAIT[action];
  if (mappedTrait && traits.includes(mappedTrait)) {
    return mappedTrait as ScreenActionHighlightTarget;
  }

  // A social action draws its own provider button, so the highlight lands on that
  // button. This replaces the 1:N fudge UF-038 recorded, where *any* flexible
  // action on a screen carrying the trait lit up the whole anonymous cluster
  // because no single button could be identified (UF-051).
  if (isSocialAction(action)) return 'social-action';

  // The trait's placeholder cluster is anonymous by design, so it is the right
  // target only while the flow models no providers at all.
  if (traits.includes('social-login-buttons') && screenInteractionSideTier(action) === 'flexible') {
    return 'social-login-buttons';
  }

  const tier = screenInteractionSideTier(action);
  if (tier === 'primary') {
    if (kind === 'passkey-auth' && fields.some((field) => field.type === 'passkey')) {
      return 'passkey-field';
    }
    return 'primary-cta';
  }
  if (tier === 'retreat') return 'retreat';

  return 'callout';
}

export function traitHighlightTarget(trait: TraitId): ScreenActionHighlightTarget | null {
  if (TRAIT_TARGETS.has(trait as ScreenActionHighlightTarget)) {
    return trait as ScreenActionHighlightTarget;
  }
  return null;
}

export function ActionHighlightShell({
  active,
  label,
  children,
  className,
}: {
  active: boolean;
  label?: string;
  children: ReactNode;
  className?: string;
}) {
  return (
    <div
      className={
        `${className ?? ''} ${active ? PLAYER_ACTION_HIGHLIGHT_CLASS : ''}`.trim() || undefined
      }
      data-action-highlight={active || undefined}
      title={active ? label : undefined}
    >
      {children}
    </div>
  );
}

export function PlayerActionCallout({
  action,
  exitLabel,
}: {
  action: string;
  exitLabel?: string | null;
}) {
  const label = actionHighlightLabel(action, exitLabel);
  return (
    <div
      className={`${PLAYER_ACTION_HIGHLIGHT_CLASS} px-2.5 py-1.5 text-center text-[10px] font-medium text-accent-primary-fg-emphasis flow-dark:text-accent-primary-fg-on-bg`}
      data-action-highlight
      title={`Next step: ${label}`}
    >
      → {label}
    </div>
  );
}

export function useScreenActionHighlight(
  node: ScreenNode,
  highlightedAction: string | null | undefined,
  exitLabel?: string | null,
) {
  if (!highlightedAction) {
    return {
      target: null as ScreenActionHighlightTarget | null,
      label: null as string | null,
      isTraitHighlighted: (_trait: TraitId) => false,
      isPasskeyFieldHighlighted: (_field: Field) => false,
    };
  }

  const target = resolveScreenActionHighlightTarget(
    highlightedAction,
    node.traits,
    node.fields,
    node.kind,
  );
  const label = actionHighlightLabel(highlightedAction, exitLabel);

  return {
    target,
    label,
    isTraitHighlighted: (trait: TraitId) => traitHighlightTarget(trait) === target,
    isPasskeyFieldHighlighted: (field: Field) =>
      target === 'passkey-field' && field.type === 'passkey',
  };
}
