// Dispatches a Screen node to its fidelity-tier renderer (US-069).

import type { Branding, ScreenNode } from '@authprint/dsl';
import { ScreenLoFi } from './ScreenLoFi.tsx';
import { ScreenMockup } from './ScreenMockup.tsx';
import { ScreenWireframe } from './ScreenWireframe.tsx';

export function ScreenFidelityView({
  node,
  branding,
}: {
  node: ScreenNode;
  /** Only the mockup tier renders a brand block. */
  branding?: Branding;
}) {
  switch (node.fidelity) {
    case 'mockup':
      return <ScreenMockup node={node} branding={branding} />;
    case 'wireframe':
      return <ScreenWireframe node={node} />;
    case 'lo-fi':
      return <ScreenLoFi node={node} />;
  }
}
