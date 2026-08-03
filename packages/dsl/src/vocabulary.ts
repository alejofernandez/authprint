// Curated DSL vocabulary. Source of truth: packages/dsl-spec/vocabulary.md.
//
// Each "Builtin" array drives autocomplete + the warning-on-unknown-kind logic
// in the parser. Closed-set categories (traits, predicate ops, slot types,
// trigger types, structural types) are enforced by zod enums in schema/.

// ─── Structural node types ──────────────────────────────────────────────────

export const STRUCTURAL_TYPES = [
  'entry',
  'screen',
  'decision',
  'action',
  'external',
  'outcome',
] as const;
export type StructuralType = (typeof STRUCTURAL_TYPES)[number];

// ─── Screen kinds (extensible) ──────────────────────────────────────────────

export const SCREEN_KINDS_BUILTIN = [
  'identifier-collect',
  'email-collect',
  'password',
  'new-password',
  'passkey-enroll',
  'passkey-auth',
  'mfa-challenge',
  'mfa-enroll',
  'consent',
  'terms-acceptance',
  'email-verify',
  'phone-verify',
  'provider-select',
  'magic-link-sent',
  'signup-confirmation',
  'account-recovery',
  'error',
  'loading',
] as const;
export type ScreenKindBuiltin = (typeof SCREEN_KINDS_BUILTIN)[number];
// The `(string & {})` trick preserves IDE autocomplete on built-ins while
// allowing arbitrary custom strings. Standard TypeScript idiom.
export type ScreenKind = ScreenKindBuiltin | (string & {});

// ─── Decision kinds (extensible) ────────────────────────────────────────────

export const DECISION_KINDS_BUILTIN = [
  'user-exists',
  'email-verified',
  'mfa-required',
  'mfa-enrolled',
  'passkey-available',
  'social-account-linked',
  'risk-elevated',
  'device-known',
  'consent-granted',
  'account-locked',
] as const;
export type DecisionKindBuiltin = (typeof DECISION_KINDS_BUILTIN)[number];
export type DecisionKind = DecisionKindBuiltin | (string & {});

// ─── Action kinds (extensible) ──────────────────────────────────────────────

export const ACTION_KINDS_BUILTIN = [
  'validate-credentials',
  'create-user',
  'link-social-account',
  'send-otp',
  'send-magic-link',
  'send-verification',
  'verify-otp',
  'enroll-factor',
  'revoke-session',
  'log-event',
] as const;
export type ActionKindBuiltin = (typeof ACTION_KINDS_BUILTIN)[number];
export type ActionKind = ActionKindBuiltin | (string & {});

// ─── External kinds (extensible) ────────────────────────────────────────────

export const EXTERNAL_KINDS_BUILTIN = [
  'google',
  'apple',
  'facebook',
  'github',
  'microsoft',
  'oauth-provider',
  'oidc-provider',
] as const;
export type ExternalKindBuiltin = (typeof EXTERNAL_KINDS_BUILTIN)[number];
export type ExternalKind = ExternalKindBuiltin | (string & {});

// ─── Outcome kinds (extensible) ─────────────────────────────────────────────

export const OUTCOME_KINDS_BUILTIN = [
  'authenticated',
  'account-created',
  'factor-enrolled',
  'denied',
  'abandoned',
  'error',
  'redirected',
] as const;
export type OutcomeKindBuiltin = (typeof OUTCOME_KINDS_BUILTIN)[number];
export type OutcomeKind = OutcomeKindBuiltin | (string & {});

// ─── Trait identifiers (CLOSED set) ─────────────────────────────────────────

export const TRAIT_IDS = [
  'captcha',
  'bot-detection-invisible',
  'remember-me',
  'forgot-password-link',
  'alternative-method-link',
  'terms-checkbox-required',
  'marketing-opt-in',
  'password-strength-meter',
  'show-password-toggle',
  'social-login-buttons',
  'passkey-promotion',
  'error-banner',
] as const;
export type TraitId = (typeof TRAIT_IDS)[number];

// ─── Field types (extensible) ───────────────────────────────────────────────

export const FIELD_TYPES_BUILTIN = [
  'identifier',
  'email',
  'phone',
  'username',
  'password',
  'new-password',
  'confirm-password',
  'otp',
  'checkbox',
  'passkey',
  'text',
  'custom',
] as const;
export type FieldTypeBuiltin = (typeof FIELD_TYPES_BUILTIN)[number];
export type FieldType = FieldTypeBuiltin | (string & {});

// ─── Flow theme (CLOSED set) ────────────────────────────────────────────────

export const FLOW_THEMES = ['light', 'dark', 'both'] as const;
export type FlowTheme = (typeof FLOW_THEMES)[number];

// ─── Edge trigger types (CLOSED set) ────────────────────────────────────────

export const TRIGGER_TYPES = [
  'unconditional',
  'interaction',
  'branch',
  'on-success',
  'on-error',
  'on-denied',
  'on-cancelled',
] as const;
export type TriggerType = (typeof TRIGGER_TYPES)[number];

// ─── User action labels (extensible) ────────────────────────────────────────

export const USER_ACTIONS_BUILTIN = [
  'submit',
  'cancel',
  'back',
  'skip',
  'try-another-method',
  'forgot-password',
  'sign-up',
  'sign-in',
  'resend-code',
  'accept',
  'decline',
  'use-passkey',
  // Social sign-in. Providers are modelled as *actions*, never as traits: the
  // trait set is closed and curated by design (§5) and providers are an
  // open-ended set, so they belong on the axis that already accepts custom
  // values freely. These five are the common ones; any other provider is a
  // custom `social-*` action and needs no addition here.
  'social-login',
  'social-google',
  'social-apple',
  'social-microsoft',
  'social-facebook',
  'social-github',
] as const;
export type UserActionBuiltin = (typeof USER_ACTIONS_BUILTIN)[number];
export type UserAction = UserActionBuiltin | (string & {});

/** Prefix marking an action as social sign-in, built-in or custom. */
export const SOCIAL_ACTION_PREFIX = 'social-';

/** Whether an action is social sign-in. `social-login` (the generic provider
 *  chooser) counts; it is one button rather than none. */
export function isSocialAction(action: string): boolean {
  return action.startsWith(SOCIAL_ACTION_PREFIX);
}

/** The provider an action names, or null for the generic `social-login`.
 *  Returns the raw segment so custom providers work without registration. */
export function socialProviderForAction(action: string): string | null {
  if (!isSocialAction(action) || action === 'social-login') return null;
  return action.slice(SOCIAL_ACTION_PREFIX.length) || null;
}

// ─── Traits and the actions they stand for ──────────────────────────────────
// Two ways to say the same thing, both legitimate (§5): the trait says "there
// is an affordance here" without modelling where it goes; the action is a
// modelled transition. Carrying both means the screen advertises it twice, so
// renderers draw exactly one and validation mentions the duplication.
//
// **Which one renders is a view decision, not a vocabulary one**, and it is not
// always the action (UF-049): when the trait's chrome is a richer affordance
// than a text link — the passkey banner against a "Use passkey" link — the
// chrome is the better drawing of the same step. This map only asserts the two
// are equivalent; `traitChrome.tsx` owns the choice, since chrome shape is
// known there and not here.
//
// Deliberately only the 1:1 pairs. `social-login-buttons` overlaps with the
// per-provider actions (`google`, `apple`, …) but is 1:N and renders as a
// different affordance (provider buttons, not a link), so it is not reconciled
// here — see USABILITY UF-038.
export const EQUIVALENT_TRAIT_ACTION = {
  'forgot-password-link': 'forgot-password',
  'alternative-method-link': 'try-another-method',
  'passkey-promotion': 'use-passkey',
} as const satisfies Partial<Record<TraitId, UserActionBuiltin>>;

export type EquivalentTrait = keyof typeof EQUIVALENT_TRAIT_ACTION;

/** The action a trait stands for, or undefined when it stands for none. */
export function actionForTrait(trait: string): string | undefined {
  return (EQUIVALENT_TRAIT_ACTION as Record<string, string>)[trait];
}

/** The trait an action is equivalent to, or undefined when none is. */
export function traitForAction(action: string): string | undefined {
  return Object.entries(EQUIVALENT_TRAIT_ACTION).find(([, a]) => a === action)?.[0];
}

// ─── Predicate operators (CLOSED set) ───────────────────────────────────────

export const PREDICATE_OPS = [
  'equals',
  'not-equals',
  'greater-than',
  'less-than',
  'greater-than-or-equal',
  'less-than-or-equal',
  'in',
  'not-in',
] as const;
export type PredicateOp = (typeof PREDICATE_OPS)[number];

// ─── Context slot types (CLOSED set) ────────────────────────────────────────

export const SLOT_TYPES = ['boolean', 'number', 'string', 'enum'] as const;
export type SlotType = (typeof SLOT_TYPES)[number];

// ─── Annotation kinds (CLOSED set v1) ───────────────────────────────────────

export const ANNOTATION_KINDS = ['note', 'rationale'] as const;
export type AnnotationKind = (typeof ANNOTATION_KINDS)[number];

// ─── Helpers ────────────────────────────────────────────────────────────────

/** Type guard: is `s` a built-in screen kind? */
export const isBuiltinScreenKind = (s: string): s is ScreenKindBuiltin =>
  (SCREEN_KINDS_BUILTIN as readonly string[]).includes(s);

/** Type guard: is `s` a built-in decision kind? */
export const isBuiltinDecisionKind = (s: string): s is DecisionKindBuiltin =>
  (DECISION_KINDS_BUILTIN as readonly string[]).includes(s);

/** Type guard: is `s` a built-in action kind? */
export const isBuiltinActionKind = (s: string): s is ActionKindBuiltin =>
  (ACTION_KINDS_BUILTIN as readonly string[]).includes(s);

/** Type guard: is `s` a built-in external kind? */
export const isBuiltinExternalKind = (s: string): s is ExternalKindBuiltin =>
  (EXTERNAL_KINDS_BUILTIN as readonly string[]).includes(s);

/** Type guard: is `s` a built-in outcome kind? */
export const isBuiltinOutcomeKind = (s: string): s is OutcomeKindBuiltin =>
  (OUTCOME_KINDS_BUILTIN as readonly string[]).includes(s);

/** Type guard: is `s` a built-in field type? */
export const isBuiltinFieldType = (s: string): s is FieldTypeBuiltin =>
  (FIELD_TYPES_BUILTIN as readonly string[]).includes(s);
