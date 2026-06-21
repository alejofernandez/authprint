# Authprint DSL — Vocabulary

> Canonical vocabulary for the Authprint DSL v0. Applies **Principle 7** (familiar names > spec-correct names).
>
> The DSL accepts custom identifiers where noted. The curated vocabulary below drives icons, defaults, autocomplete, template matching, and structural validation.

## Conventions

- **DSL surface identifiers (kind tags, trait identifiers, field types, trigger type values, action labels) are kebab-case lowercase**, ASCII letters / digits / hyphens only. No special characters (no `?`, `!`, `:`, etc.). Example: `passkey-auth`, `user-exists`, `on-success`.
- **DSL structural keys (object property names like `type`, `kind`, `nodes`, `edges`, `traits`, `fields`) are camelCase**, per JSON convention.
- **TypeScript types use PascalCase for type names** (`Screen`, `Decision`, `Edge`) but match the DSL surface for literal-string values (e.g., `type ScreenKind = 'password' | 'passkey-auth' | ...`).
- **No `?` suffix** on Decision kinds. The Lisp/Ruby convention (`user-exists?`) is dropped because the structural type already conveys "this is a question"; verb naming reads cleanly without the suffix.

---

## Structural types

The closed set of node types. DSL `type:` field carries the lowercase string.

| DSL value | TS type | Purpose |
|---|---|---|
| `entry` | `Entry` | Flow start. Exactly one per flow. |
| `screen` | `Screen` | User-facing step. Carries `kind`, `traits`, `fields`. |
| `decision` | `Decision` | Predicate-evaluated branching. No UI. |
| `action` | `Action` | Server-side step. No UI. Mandatory `on-success` + `on-error` outgoing edges. |
| `external` | `External` | Hand-off to external system. Visual treatment: "you leave and return." |
| `outcome` | `Outcome` | Terminal state. Multiple per flow allowed. |

---

## Screen kinds

Curated kinds for `screen` nodes. Custom strings allowed; render with generic visual treatment.

| Kind | What it is |
|---|---|
| `identifier-collect` | Generic identifier (email/username/phone, type unspecified) |
| `email-collect` | Email-specific entry |
| `password` | Password entry (for sign-in) |
| `new-password` | New password creation (sign-up or reset) |
| `passkey-enroll` | Passkey enrollment ceremony |
| `passkey-auth` | Passkey authentication ceremony |
| `mfa-challenge` | MFA challenge prompt (OTP, push, etc.) |
| `mfa-enroll` | MFA factor enrollment |
| `consent` | Consent / authorization confirmation |
| `terms-acceptance` | Terms-of-service acceptance (renamed from `tos`) |
| `email-verify` | Email verification challenge |
| `phone-verify` | Phone verification challenge |
| `provider-select` | Identity-provider chooser (renamed from `idp-select`) |
| `magic-link-sent` | "Check your email" confirmation after magic-link send |
| `account-recovery` | Account recovery entry point |
| `error` | Error display |
| `loading` | Async-operation loading state |

---

## Decision kinds

Curated kinds for `decision` nodes. The structural type already implies "question"; no `?` suffix.

| Kind | Checks |
|---|---|
| `user-exists` | Does an account already exist for the identifier? |
| `email-verified` | Has the user's email been verified? |
| `mfa-required` | Does policy require a second factor? |
| `mfa-enrolled` | Does the user have an MFA factor enrolled? |
| `passkey-available` | Does the user have a registered passkey? |
| `social-account-linked` | Is a social provider linked to this account? |
| `risk-elevated` | Is the current risk signal above threshold? |
| `device-known` | Is the device recognized? |
| `consent-granted` | Has consent been granted for the requested scope? |
| `account-locked` | Is the account currently locked? |

---

## Action kinds

Curated kinds for `action` nodes (server-side steps; no UI).

| Kind | What it does |
|---|---|
| `validate-credentials` | Verify identifier + secret |
| `create-user` | Create a new user account |
| `link-social-account` | Link a social provider to an existing account |
| `send-otp` | Generate and dispatch a one-time numeric code |
| `send-magic-link` | Generate and dispatch a magic-link email |
| `send-verification` | Generic verification dispatch (email or phone) |
| `verify-otp` | Verify a submitted OTP code |
| `enroll-factor` | Enroll a new auth factor (passkey, TOTP, etc.) |
| `revoke-session` | Revoke a session token |
| `log-event` | Emit an audit event |

---

## External kinds

Curated kinds for `external` nodes (hand-off to outside system).

| Kind | Hand-off target |
|---|---|
| `google` | Google sign-in (renamed from `google-oidc` — practitioners say "Google sign-in", not "Google OIDC") |
| `apple` | Apple sign-in (renamed from `apple-idp`) |
| `facebook` | Facebook login |
| `github` | GitHub OAuth |
| `microsoft` | Microsoft account sign-in |
| `oauth-provider` | Generic OAuth provider (configured per flow) |
| `oidc-provider` | Generic OIDC provider (renamed from `oidc-idp`) |

Note: passkey ceremonies happen inline on `passkey-auth` / `passkey-enroll` Screens — not as `external` nodes — because the user doesn't really leave the app the way Google OAuth does. The OS-level passkey prompt is implicit in the Screen.

---

## Outcome kinds

Curated kinds for `outcome` nodes (terminal states).

| Kind | What it represents |
|---|---|
| `authenticated` | User successfully authenticated |
| `account-created` | New account created (signup-completion variant of authenticated) |
| `factor-enrolled` | New factor enrolled successfully |
| `denied` | Access explicitly denied (policy decision) |
| `abandoned` | User left the flow without completing |
| `error` | Unrecoverable error |
| `redirected` | User was redirected out of the flow (to RP, IdP, etc.) |

---

## Trait identifiers (`Screen` only)

Curated traits — declarative modifiers on Screens that don't add transitions.

| Trait | What it declares |
|---|---|
| `captcha` | Screen is protected by CAPTCHA |
| `bot-detection-invisible` | Invisible bot-detection challenge is active |
| `remember-me` | Screen offers a "remember me" option |
| `forgot-password-link` | Screen exposes a recovery link |
| `alternative-method-link` | Screen offers a switch to another auth method |
| `terms-checkbox-required` | Screen requires explicit TOS acceptance via checkbox |
| `marketing-opt-in` | Screen exposes a marketing opt-in (optional) |
| `password-strength-meter` | New-password screen displays a strength meter |
| `show-password-toggle` | Screen allows toggling password visibility |
| `social-login-buttons` | Screen surfaces social-provider buttons |
| `passkey-promotion` | Screen encourages passkey enrollment |

**v1 only allows traits from this list.** Custom trait identifiers are not accepted by the validator in v1; the vocabulary expands through review.

---

## Field types

Curated types for the `fields` array on `screen` nodes. Each field is `{ name: string, type: FieldType, required: boolean }`.

| Field type | Use |
|---|---|
| `identifier` | Generic identifier — email/username/phone, unspecified |
| `email` | Email address |
| `phone` | Phone number |
| `username` | Username |
| `password` | Existing password (for sign-in) |
| `new-password` | New password (for sign-up or password change) |
| `confirm-password` | Password confirmation |
| `otp` | One-time numeric code |
| `consent-checkbox` | Boolean consent toggle |
| `passkey` | Passkey credential (renamed from `webauthn-credential` — practitioners say "passkey", not "WebAuthn credential") |
| `text` | Generic free-text input |
| `custom` | Escape hatch for fields the curated vocabulary doesn't cover |

The `custom` escape exists because real-world screens have genuinely unusual inputs (e.g., security questions, account-numbers, recovery codes). Traits get no equivalent escape — vocabulary is tightly curated by design.

---

## Edge trigger types

Triggers are typed by source structural type per §5. DSL representation: `trigger: { type: <trigger-type>, ... }`.

| Trigger type | Used on edges from | Carries |
|---|---|---|
| `unconditional` | `entry` | nothing |
| `interaction` | `screen` | `action: <user-action-label>` (see below) |
| `branch` | `decision` | `value: <predicate-outcome>` |
| `on-success` | `action`, `external` | nothing |
| `on-error` | `action`, `external` | nothing |
| `on-denied` | `external` | nothing |
| `on-cancelled` | `external` | nothing |

**`on-success` and `on-error` are mandatory** on outgoing edges from `action` and `external`, per §5 and §6 (validation enforces).

The trigger type `interaction` was chosen over the §5-flagged `UserAction` rename candidate because:
- The structural type `Action` already exists; trigger type `UserAction` was a confusing overload.
- `interaction` accurately describes the category (user does something on the screen).

---

## User action labels

Used as the `action` value of an `interaction` trigger. Curated set; custom labels allowed.

| Label | What it represents |
|---|---|
| `submit` | Primary form submission |
| `cancel` | Explicit cancel |
| `back` | Navigate back |
| `skip` | Skip an optional step |
| `try-another-method` | Switch auth methods (passkey ↔ password ↔ social, etc.) |
| `forgot-password` | Trigger recovery flow |
| `sign-up` | Switch from sign-in to sign-up |
| `sign-in` | Switch from sign-up to sign-in |
| `resend-code` | Request a fresh OTP / magic link |
| `accept` | Accept (consent / terms) |
| `decline` | Decline (consent / terms) |

---

## Predicate operators

Used inside `decision.predicate = { slot, op, value }`.

| Operator | Meaning |
|---|---|
| `equals` | Slot value equals comparison value |
| `not-equals` | Slot value does not equal comparison value |
| `greater-than` | Slot value > comparison value (numeric slots) |
| `less-than` | Slot value < comparison value (numeric slots) |
| `greater-than-or-equal` | Slot value >= comparison value (numeric slots) |
| `less-than-or-equal` | Slot value <= comparison value (numeric slots) |
| `in` | Slot value is one of an array of values |
| `not-in` | Slot value is not one of an array of values |

Verbose over `gt` / `lt` / `gte` / `lte` deliberately — the DSL is read more than it's written, and the audience reads English faster than math abbreviations.

---

## Context slot types

Used inside `flow.context.<slot-name> = { type: SlotType, values?: string[] }`.

| Slot type | Value shape |
|---|---|
| `boolean` | `true` / `false` |
| `number` | numeric (integer or float) |
| `string` | arbitrary string |
| `enum` | one of `values: string[]` (required when `type: 'enum'`) |

Slots are *declarations*. Authprint is not an execution engine; slot runtime values exist only inside Scenarios.

---

## Rejected names (and why)

These spec-correct or common-tech names were considered and rejected per Principle 7. Documented here so future contributors don't relitigate.

| Rejected | In favor of | Reason |
|---|---|---|
| `relying-party`, `RP` | not used | Pure OAuth/OIDC spec jargon; practitioners say "app" or "service" |
| `resource-server`, `resource-owner` | not used | OAuth spec terms; never appear in PM/SA conversation |
| `WebAuthn credential` | `passkey` | Spec name; users / PMs / SAs all say "passkey" |
| `webauthn-platform` (External kind) | (removed) | Passkey ceremonies are inline on the Screen, not external hand-offs |
| `idp-select` | `provider-select` | `IdP` is jargon for SAs; `provider` is universal |
| `google-oidc`, `apple-idp`, `oidc-idp` | `google`, `apple`, `oidc-provider` | Practitioners say "Google sign-in" not "Google OIDC" |
| `tos` | `terms-acceptance` | Abbreviation hides intent; readable name aids new contributors |
| `authentication` (as concept name) | `sign-in` (as flow concept) | `sign-in` is what users do; `authentication` is what spec authors describe |
| `identity-provider` (full form) | `provider` | Both are understood, shorter wins |
| `multi-factor authentication` (full form) | `mfa-*` (kept as MFA) | `MFA` IS daily practitioner vocabulary; rare case where the abbreviation is the familiar form |
| `gt`/`lt`/`gte`/`lte` | `greater-than`/`less-than`/etc. | Math abbreviations are read-time friction in a config file |
| Decision kinds with `?` suffix (`user-exists?`) | no suffix (`user-exists`) | Lisp/Ruby convention; structural type already implies "question" |
| `UserAction` (trigger type) | `interaction` | Overloaded with `Action` structural type — created confusion |
| `branding-customizable` (trait) | (removed) | Tool-level concern, not a flow-design concern |

---

## Extension model

- **Kind / field-type identifiers**: DSL parser accepts unknown values as custom; validator emits `vocabulary-unknown-kind` warning (not error). Custom values render with generic visual treatment in the canvas.
- **Trait identifiers**: validator **rejects** unknown values (errors, not warnings). Trait vocabulary is curated by design — additions go through maintainer review.
- **User action labels**: accepts custom freely; common patterns surface as autocomplete.
- **Predicate operators**: closed set; cannot be extended in v1.
- **Context slot types**: closed set; cannot be extended in v1.
- **Structural types**: closed set permanently (these define the graph semantics).
