// React Flow `nodeTypes` registry. Keys match the structural type literal
// from `@authprint/dsl` (Node['type']); values are the React components.

import { ActionNodeView } from './ActionNodeView.tsx';
import { DecisionNodeView } from './DecisionNodeView.tsx';
import { EntryNodeView } from './EntryNodeView.tsx';
import { ExternalNodeView } from './ExternalNodeView.tsx';
import { OutcomeNodeView } from './OutcomeNodeView.tsx';
import { ScreenNodeView } from './ScreenNodeView.tsx';

export const nodeTypes = {
  entry: EntryNodeView,
  screen: ScreenNodeView,
  decision: DecisionNodeView,
  action: ActionNodeView,
  external: ExternalNodeView,
  outcome: OutcomeNodeView,
} as const;

export type { CanvasNodeData } from './shared.ts';
