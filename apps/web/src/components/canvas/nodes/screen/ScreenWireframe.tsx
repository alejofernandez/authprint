// Wireframe screen tier (US-069) — the mockup card anatomy as neutral grey
// placeholder bars: no styled copy, structural blocks only.

import type { Field, ScreenNode, TraitId } from '@authprint/dsl';
import { PlayerScreenCard } from './PlayerScreenCard.tsx';
import {
  ActionHighlightShell,
  PlayerActionCallout,
  useScreenActionHighlight,
} from './screenActionHighlight.tsx';
import { screenCta } from './screenCopy.ts';
import type { ScreenStageLayout } from './screenStageLayout.ts';
import {
  ErrorBanner,
  ErrorBannerPlaceholder,
  hasErrorBannerTrait,
  postCtaTraits,
} from './traitChrome.tsx';

const MASKED_TYPES = new Set(['password', 'new-password', 'confirm-password']);
const STRENGTH_METER_TYPES = new Set(['password', 'new-password']);

function Bar({ className }: { className?: string }) {
  return <div className={`rounded-md bg-zinc-200 flow-dark:bg-zinc-700 ${className ?? ''}`} />;
}

function WireframeFieldRow({
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
  const showStrengthMeter =
    STRENGTH_METER_TYPES.has(field.type) && traits.has('password-strength-meter');

  if (field.type === 'consent-checkbox') {
    return (
      <div className="flex items-center gap-1.5">
        <Bar className="h-3 w-3 shrink-0" />
        <Bar className="h-2 w-20" />
      </div>
    );
  }
  if (field.type === 'passkey') {
    return (
      <ActionHighlightShell active={highlightPasskey} label={highlightLabel ?? undefined}>
        <Bar className="h-7 w-full" />
      </ActionHighlightShell>
    );
  }
  if (field.type === 'otp') {
    return (
      <div className="space-y-1">
        <Bar className="h-2 w-10" />
        <div className="flex gap-1">
          {Array.from({ length: 6 }, (_, i) => (
            <Bar
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static wireframe boxes
              key={i}
              className="h-6 w-5"
            />
          ))}
        </div>
      </div>
    );
  }

  const masked = MASKED_TYPES.has(field.type);
  const showToggle = masked && traits.has('show-password-toggle');

  return (
    <div className="space-y-1">
      <Bar className="h-2 w-12" />
      <div className="flex items-center gap-1">
        <Bar className="h-6 flex-1" />
        {showToggle ? <Bar className="h-3 w-3 shrink-0 rounded-full" /> : null}
      </div>
      {showStrengthMeter ? (
        <div className="flex gap-0.5 pt-0.5">
          {Array.from({ length: 4 }, (_, i) => (
            <Bar
              // biome-ignore lint/suspicious/noArrayIndexKey: fixed-length static meter segments
              key={i}
              className="h-1 flex-1"
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}

function WireframeTraitBlock({ trait }: { trait: TraitId }) {
  switch (trait) {
    case 'remember-me':
    case 'terms-checkbox-required':
    case 'marketing-opt-in':
      return (
        <div className="flex items-center gap-1.5">
          <Bar className="h-3 w-3 shrink-0" />
          <Bar className="h-2 w-24" />
        </div>
      );
    case 'forgot-password-link':
    case 'alternative-method-link':
      return <Bar className="mx-auto h-2 w-20" />;
    case 'social-login-buttons':
      return (
        <div className="flex justify-center gap-2">
          {(['a', 'b', 'c'] as const).map((id) => (
            <Bar key={id} className="h-7 w-7 rounded-full" />
          ))}
        </div>
      );
    case 'passkey-promotion':
      return <Bar className="h-9 w-full" />;
    case 'captcha':
      return <Bar className="h-12 w-full" />;
    default:
      return null;
  }
}

function WireframeErrorBanner({
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

export function ScreenWireframe({
  node,
  displayErrorState = false,
  errorBannerCopy = null,
  stageLayout = 'default',
  highlightedAction = null,
  highlightedActionLabel = null,
}: {
  node: ScreenNode;
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
  const playerFrame = stageLayout === 'player';
  const showErrorSlot = playerFrame && hasErrorBannerTrait(node.traits);

  const windowChrome = (
    <div className="flex h-5 shrink-0 items-center justify-between border-b border-zinc-100 px-2.5 flow-dark:border-zinc-800">
      <div className="flex items-center gap-1">
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
        <span className="h-1.5 w-1.5 rounded-full bg-zinc-300 flow-dark:bg-zinc-600" />
      </div>
      <Bar className="h-2 w-14" />
    </div>
  );

  const headerBlock = (
    <>
      <div className="flex flex-col items-center gap-1.5 pb-1 pt-4">
        <Bar className="h-8 w-8 rounded-[9px]" />
        <Bar className="h-2.5 w-10" />
      </div>
      <Bar className="mx-auto h-3.5 w-28" />
      {!playerFrame ? (
        <WireframeErrorBanner
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
        {node.fields.map((field) => (
          <WireframeFieldRow
            key={field.name}
            field={field}
            traits={traitSet}
            highlightPasskey={highlight.isPasskeyFieldHighlighted(field)}
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
          <Bar className="h-7 w-full" />
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
              <WireframeTraitBlock trait={trait} />
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
