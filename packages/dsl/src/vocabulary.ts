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
  'consent-checkbox',
  'passkey',
  'text',
  'custom',
] as const;
export type FieldTypeBuiltin = (typeof FIELD_TYPES_BUILTIN)[number];
export type FieldType = FieldTypeBuiltin | (string & {});

// ─── Screen fidelity (CLOSED set) ───────────────────────────────────────────

export const FIDELITIES = ['lo-fi', 'wireframe', 'mockup'] as const;
export type Fidelity = (typeof FIDELITIES)[number];

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
] as const;
export type UserActionBuiltin = (typeof USER_ACTIONS_BUILTIN)[number];
export type UserAction = UserActionBuiltin | (string & {});

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
