// Dispatches a Screen node to its fidelity-tier renderer (US-069).

import type { Branding, ScreenNode } from '@authprint/dsl';
import { ScreenLoFi } from './ScreenLoFi.tsx';
import { ScreenMockup } from './ScreenMockup.tsx';
import { ScreenWireframe } from './ScreenWireframe.tsx';
import type { ScreenStageLayout } from './screenStageLayout.ts';

export function ScreenFidelityView({
  node,
  branding,
  displayErrorState = false,
  errorBannerCopy = null,
  stageLayout = 'default',
}: {
  node: ScreenNode;
  /** Only the mockup tier renders a brand block. */
  branding?: Branding;
  /** Layout preview — placeholder banner when true and no `errorBannerCopy`. */
  displayErrorState?: boolean;
  /** Player playback — resolved copy from the failing upstream node. */
  errorBannerCopy?: string | null;
  /** `player` pins header/body/footer for consistent stage height. */
  stageLayout?: ScreenStageLayout;
}) {
  switch (node.fidelity) {
    case 'mockup':
      return (
        <ScreenMockup
          node={node}
          branding={branding}
          displayErrorState={displayErrorState}
          errorBannerCopy={errorBannerCopy}
          stageLayout={stageLayout}
        />
      );
    case 'wireframe':
      return (
        <ScreenWireframe
          node={node}
          displayErrorState={displayErrorState}
          errorBannerCopy={errorBannerCopy}
          stageLayout={stageLayout}
        />
      );
    case 'lo-fi':
      return <ScreenLoFi node={node} />;
  }
}
