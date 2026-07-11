import type { ReactNode } from 'react';
import { PlayerErrorBannerSlot } from './PlayerErrorBannerSlot.tsx';

type PlayerScreenCardProps = {
  chrome: ReactNode;
  header: ReactNode;
  showErrorSlot: boolean;
  errorBannerCopy: string | null;
  fields: ReactNode;
  footer: ReactNode;
};

/** Player-stage screen shell — compact vertical stack; actions follow the body (no bottom anchor). */
export function PlayerScreenCard({
  chrome,
  header,
  showErrorSlot,
  errorBannerCopy,
  fields,
  footer,
}: PlayerScreenCardProps) {
  return (
    <div className="flex w-[244px] flex-col overflow-hidden rounded-xl border border-zinc-200 bg-white shadow-sm flow-dark:border-zinc-700 flow-dark:bg-zinc-900">
      {chrome}
      <div className="shrink-0 px-4">{header}</div>
      <div className="px-4 pb-4">
        {(showErrorSlot || fields) && (
          <div>
            {showErrorSlot ? (
              <div className="pt-1.5">
                <PlayerErrorBannerSlot copy={errorBannerCopy} />
              </div>
            ) : null}
            {fields ? <div className={showErrorSlot ? 'pt-1' : 'pt-2'}>{fields}</div> : null}
          </div>
        )}
        <div className="space-y-3 pt-6">{footer}</div>
      </div>
    </div>
  );
}
