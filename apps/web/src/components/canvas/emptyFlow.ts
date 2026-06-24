// Blank canvas default — one entry node, no edges. Bundled examples (Demo Flow
// Zero, etc.) load via the command palette; this is also a stable fixture for
// future empty-canvas visual tests.

import type { Flow } from '@authprint/dsl';

export const emptyFlow: Flow = {
  id: 'new-flow',
  name: 'Untitled flow',
  theme: 'light',
  context: {},
  nodes: [{ type: 'entry', id: 'entry' }],
  edges: [],
  annotations: [],
  scenarios: [],
};
