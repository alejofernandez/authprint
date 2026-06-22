'use client';

// Dev-only visual reference showing one of each structural-type node
// rendered on a tiny React Flow canvas with hand-placed positions. Useful
// for iterating on shape / color / spacing without loading a real flow.

import '@xyflow/react/dist/style.css';

import type { Node as DslNode } from '@authprint/dsl';
import { Background, ReactFlow, type Node as RfNode } from '@xyflow/react';
import { nodeTypes } from '../nodes/index.ts';

const sampleNodes: { id: string; type: keyof typeof nodeTypes; dslNode: DslNode }[] = [
  {
    id: 'entry-1',
    type: 'entry',
    dslNode: { type: 'entry', id: 'e1' },
  },
  {
    id: 'screen-1',
    type: 'screen',
    dslNode: {
      type: 'screen',
      id: 's1',
      name: 'Enter your email',
      kind: 'identifier-collect',
      traits: [],
      fields: [],
      fidelity: 'lo-fi',
    },
  },
  {
    id: 'decision-1',
    type: 'decision',
    dslNode: {
      type: 'decision',
      id: 'd1',
      name: 'Account exists?',
      kind: 'user-exists',
      predicate: { slot: 'user.exists', op: 'equals', value: true },
    },
  },
  {
    id: 'action-1',
    type: 'action',
    dslNode: {
      type: 'action',
      id: 'a1',
      name: 'Send sign-in code',
      kind: 'send-otp',
    },
  },
  {
    id: 'external-1',
    type: 'external',
    dslNode: {
      type: 'external',
      id: 'x1',
      name: 'Continue with Google',
      kind: 'google',
    },
  },
  {
    id: 'outcome-1',
    type: 'outcome',
    dslNode: {
      type: 'outcome',
      id: 'o1',
      name: 'Authenticated',
      kind: 'authenticated',
    },
  },
];

const rfNodes: RfNode[] = sampleNodes.map((n, i) => ({
  id: n.id,
  type: n.type,
  position: { x: 40 + (i % 3) * 280, y: 40 + Math.floor(i / 3) * 200 },
  data: { node: n.dslNode },
  draggable: true,
}));

export function NodeGallery() {
  return (
    <div className="h-dvh w-full bg-zinc-50 dark:bg-zinc-950">
      <div className="absolute top-3 left-4 z-10 text-xs text-zinc-500 dark:text-zinc-500 font-mono pointer-events-none">
        /dev/nodes — visual reference for the six structural-type node components
      </div>
      <ReactFlow nodes={rfNodes} edges={[]} nodeTypes={nodeTypes} fitView>
        <Background gap={24} size={1} />
      </ReactFlow>
    </div>
  );
}
