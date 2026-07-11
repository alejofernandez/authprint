import { PLAYER_ERROR_BANNER_SLOT_HEIGHT } from './screenStageLayout.ts';
import { ErrorBanner } from './traitChrome.tsx';

/** Fixed-height body slot — shows copy or empty padding so error appearance does not shift layout. */
export function PlayerErrorBannerSlot({ copy }: { copy: string | null }) {
  return (
    <div
      className="shrink-0"
      style={{ height: PLAYER_ERROR_BANNER_SLOT_HEIGHT }}
      aria-hidden={copy ? undefined : true}
    >
      {copy ? <ErrorBanner copy={copy} singleLine /> : <div className="h-full" />}
    </div>
  );
}
