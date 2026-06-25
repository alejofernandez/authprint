// Dispatches a Screen node to its fidelity-tier renderer (US-069).

import type { ScreenNode } from '@authprint/dsl';
import { ScreenLoFi } from './ScreenLoFi.tsx';
import { ScreenMockup } from './ScreenMockup.tsx';
import { ScreenWireframe } from './ScreenWireframe.tsx';

export function ScreenFidelityView({ node }: { node: ScreenNode }) {
  switch (node.fidelity) {
    case 'mockup':
      return <ScreenMockup node={node} />;
    case 'wireframe':
      return <ScreenWireframe node={node} />;
    case 'lo-fi':
      return <ScreenLoFi node={node} />;
  }
}
