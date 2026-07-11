// Dispatches a Screen node to its fidelity-tier renderer (US-069).

import type { Branding, ScreenNode } from '@authprint/dsl';
import { ScreenLoFi } from './ScreenLoFi.tsx';
import { ScreenMockup } from './ScreenMockup.tsx';
import { ScreenWireframe } from './ScreenWireframe.tsx';

export function ScreenFidelityView({
  node,
  branding,
  displayErrorState = false,
}: {
  node: ScreenNode;
  /** Only the mockup tier renders a brand block. */
  branding?: Branding;
  /** Layout preview — error banner hidden on canvas when false (default). */
  displayErrorState?: boolean;
}) {
  switch (node.fidelity) {
    case 'mockup':
      return <ScreenMockup node={node} branding={branding} displayErrorState={displayErrorState} />;
    case 'wireframe':
      return <ScreenWireframe node={node} displayErrorState={displayErrorState} />;
    case 'lo-fi':
      return <ScreenLoFi node={node} />;
  }
}
