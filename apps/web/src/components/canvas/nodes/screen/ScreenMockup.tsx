// Screen mockup rendering (US-067, E39) — renders a Screen node as a believable
// auth screen for `fidelity: 'mockup'`: a windowed card with a brand block, a
// kind-derived headline, field rows from `fields`, and a primary CTA. Traits
// (US-068), the wireframe/lo-fi tiers (US-069), and the Flow.branding.theme axis
// (US-070) build on this. The visual language set here is what they extend.
//
// The brand block and CTA use Flow.branding (companyName / primaryColor,
// US-098) when the flow has set it; falling back to the original brand-neutral
// "Acme" + indigo placeholder when it hasn't.

import type { Branding, Field, ScreenNode, TraitId } from '@authprint/dsl';
import { PlayerScreenCard } from './PlayerScreenCard.tsx';
import {
  ActionHighlightShell,
  PlayerActionCallout,
  useScreenActionHighlight,
} from './screenActionHighlight.tsx';
import { humanize, screenCta } from './screenCopy.ts';
import type { ScreenStageLayout } from './screenStageLayout.ts';
import {
  ErrorBanner,
  ErrorBannerPlaceholder,
  hasErrorBannerTrait,
  PasswordStrengthMeter,
  postCtaTraits,
  ShowPasswordToggle,
  TraitChromeBlock,
} from './traitChrome.tsx';

const MASKED_TYPES = new Set(['password', 'new-password', 'confirm-password']);
const STRENGTH_METER_TYPES = new Set(['password', 'new-password']);
const PLACEHOLDER_COMPANY_NAME = 'Acme';
/** Matches Tailwind's indigo-500 — the mockup's original hardcoded accent. */
const PLACEHOLDER_PRIMARY_COLOR = '#6366f1';

// "A" monogram in a square tinted with the flow's primary color (brand-neutral
// placeholder when unset).
function Monogram({ primaryColor }: { primaryColor: string }) {
  return (
    <span
      className="inline-flex w-8 h-8 items-center justify-center rounded-[9px]"
      style={{ backgroundColor: primaryColor }}
    >
      <svg viewBox="0 0 20 20" className="w-4 h-4" fill="none" aria-hidden="true">
        <path
          d="M10 4 L4.5 16 M10 4 L15.5 16 M7 12.5 H13"
          stroke="white"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    </span>
  );
}

function TextInput({ masked, showToggle }: { masked: boolean; showToggle?: boolean }) {
  return (
    <div className="h-6 rounded-md border border-zinc-200 flow-dark:border-zinc-700 bg-zinc-50 flow-dark:bg-zinc-800/60 px-2 flex items-center justify-between gap-1">
      {masked ? (
        <span className="text-[10px] tracking-[0.2em] text-zinc-400 flow-dark:text-zinc-500">
          ••••••••
        </span>
      ) : (
        <span />
      )}
      {showToggle ? <ShowPasswordToggle /> : null}
    </div>
  );
}

function OtpInput() {
  return (
    <div className="flex gap-1">
      {Array.from({ length: 6 }, (_, i) => (
        <div
          // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static mockup boxes
          key={i}
          className="w-5 h-6 rounded-md border border-zinc-200 flow-dark:border-zinc-700 bg-zinc-50 flow-dark:bg-zinc-800/60"
        />
      ))}
    </div>
  );
}

function PasskeyButton() {
  return (
    <div className="h-7 rounded-md border border-zinc-300 flow-dark:border-zinc-600 bg-white flow-dark:bg-zinc-800 flex items-center justify-center gap-1.5 text-[11px] font-medium text-zinc-700 flow-dark:text-zinc-200">
      <svg viewBox="0 0 16 16" className="w-3 h-3" fill="none" aria-hidden="true">
        <circle cx="5.5" cy="6" r="3" stroke="currentColor" strokeWidth="1.4" />
        <path
          d="M8 8l5 5M11 11l1.5-1.5M13 13l1.5-1.5"
          stroke="currentColor"
          strokeWidth="1.4"
          strokeLinecap="round"
        />
      </svg>
      Passkey
    </div>
  );
}

function FieldRow({
  field,
  traits,
  highlightPasskey = false,
  highlightLabel,
}: {
  field: Field;
  traits: ReadonlySet<TraitId>;
  highlightPasskey?: boolean;
  highlightLabel?: string | null;
}) {
  if (field.type === 'consent-checkbox') {
    // A static mock of a checkbox row — not a real control, so a plain div
    // (not <label>) is correct here.
    return (
      <div className="flex items-center gap-1.5 text-[10px] text-zinc-600 flow-dark:text-zinc-300">
        <span className="w-3 h-3 rounded-[3px] border border-zinc-300 flow-dark:border-zinc-600 bg-zinc-50 flow-dark:bg-zinc-800/60" />
        {humanize(field.name)}
      </div>
    );
  }
  if (field.type === 'passkey') {
    return (
      <ActionHighlightShell active={highlightPasskey} label={highlightLabel ?? undefined}>
        <PasskeyButton />
      </ActionHighlightShell>
    );
  }

  const masked = MASKED_TYPES.has(field.type);
  const showToggle = masked && traits.has('show-password-toggle');
  const showStrengthMeter =
    STRENGTH_METER_TYPES.has(field.type) && traits.has('password-strength-meter');

  return (
    <div className="space-y-1">
      <div className="text-[9px] font-medium text-zinc-500 flow-dark:text-zinc-400">
        {humanize(field.name)}
      </div>
      {field.type === 'otp' ? <OtpInput /> : <TextInput masked={masked} showToggle={showToggle} />}
      {showStrengthMeter ? <PasswordStrengthMeter /> : null}
    </div>
  );
}

function MockupErrorBanner({
  traits,
  displayErrorState,
  errorBannerCopy,
}: {
  traits: TraitId[];
  displayErrorState: boolean;
  errorBannerCopy: string | null;
}) {
  if (!hasErrorBannerTrait(traits)) return null;
  if (errorBannerCopy) return <ErrorBanner copy={errorBannerCopy} />;
  if (displayErrorState) return <ErrorBannerPlaceholder />;
  return null;
}

export function ScreenMockup({
  node,
  branding,
  displayErrorState = false,
  errorBannerCopy = null,
  stageLayout = 'default',
  highlightedAction = null,
  highlightedActionLabel = null,
}: {
  node: ScreenNode;
  branding?: Branding;
  displayErrorState?: boolean;
  errorBannerCopy?: string | null;
  stageLayout?: ScreenStageLayout;
  highlightedAction?: string | null;
  highlightedActionLabel?: string | null;
}) {
  const cta = screenCta(node.kind);
  const traitSet = new Set(node.traits);
  const traitsAfterCta = postCtaTraits(node.traits);
  const highlight = useScreenActionHighlight(node, highlightedAction, highlightedActionLabel);
  const companyName = branding?.companyName || PLACEHOLDER_COMPANY_NAME;
  const primaryColor = branding?.primaryColor || PLACEHOLDER_PRIMARY_COLOR;
  const playerFrame = stageLayout === 'player';
  const showErrorSlot = playerFrame && hasErrorBannerTrait(node.traits);

  const windowChrome = (
    <div className="flex h-5 shrink-0 items-center justify-between border-b border-zinc-100 px-2.5 flow-dark:border-zinc-800">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
      </div>
      <span className="font-mono text-[8px] text-zinc-400 flow-dark:text-zinc-500">
        {node.kind}
      </span>
    </div>
  );

  const headerBlock = (
    <>
      <div className="flex flex-col items-center gap-1.5 pb-1 pt-4">
        <Monogram primaryColor={primaryColor} />
        <span className="text-[11px] font-semibold text-zinc-600 flow-dark:text-zinc-300">
          {companyName}
        </span>
      </div>
      <div className="text-center text-[13px] font-semibold leading-tight text-zinc-900 flow-dark:text-zinc-100">
        {node.name}
      </div>
      {!playerFrame ? (
        <MockupErrorBanner
          traits={node.traits}
          displayErrorState={displayErrorState}
          errorBannerCopy={errorBannerCopy}
        />
      ) : null}
    </>
  );

  const fieldsBlock =
    node.fields.length > 0 ? (
      <div className="space-y-2">
        {node.fields.map((f) => (
          <FieldRow
            key={f.name}
            field={f}
            traits={traitSet}
            highlightPasskey={highlight.isPasskeyFieldHighlighted(f)}
            highlightLabel={highlight.label}
          />
        ))}
      </div>
    ) : null;

  const footerBlock = (
    <>
      {cta ? (
        <ActionHighlightShell
          active={highlight.target === 'primary-cta'}
          label={highlight.label ?? undefined}
        >
          <div
            className="flex h-7 items-center justify-center rounded-md font-medium text-[11px] text-white"
            style={{ backgroundColor: primaryColor }}
          >
            {cta}
          </div>
        </ActionHighlightShell>
      ) : null}
      {traitsAfterCta.length > 0 ? (
        <div className="space-y-2">
          {traitsAfterCta.map((trait) => (
            <ActionHighlightShell
              key={trait}
              active={highlight.isTraitHighlighted(trait)}
              label={highlight.label ?? undefined}
            >
              <TraitChromeBlock trait={trait} />
            </ActionHighlightShell>
          ))}
        </div>
      ) : null}
      {highlight.target === 'retreat' || highlight.target === 'callout' ? (
        <PlayerActionCallout action={highlightedAction ?? ''} exitLabel={highlightedActionLabel} />
      ) : null}
    </>
  );

  if (playerFrame) {
    return (
      <PlayerScreenCard
        chrome={windowChrome}
        header={headerBlock}
        showErrorSlot={showErrorSlot}
        errorBannerCopy={errorBannerCopy}
        fields={fieldsBlock}
        footer={footerBlock}
      />
    );
  }

  return (
    <div className="w-[244px] overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm flow-dark:border-zinc-700 flow-dark:bg-zinc-900">
      {windowChrome}
      <div className="space-y-3 px-4 pb-4">
        {headerBlock}
        {fieldsBlock}
        {footerBlock}
      </div>
    </div>
  );
}
