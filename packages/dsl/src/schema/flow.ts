import { z } from 'zod';
import { FLOW_THEMES } from '../vocabulary.ts';
import { AnnotationSchema } from './annotation.ts';
import { EdgeSchema } from './edge.ts';
import { NodeSchema } from './node.ts';
import { ContextSchema } from './predicate.ts';
import { ScenarioSchema } from './scenario.ts';

// The top-level Flow container per REQUIREMENTS.md §5 Flow-level attributes.
//
// An .authprint file's root IS a Flow — there is no wrapper key. Forward-compat
// for schema-format versioning (if ever needed) will use a top-level
// `apiVersion: authprint/vN` field (Kubernetes-style), not a nested wrapper.

export const FlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),

  // Flow.theme is the rendering theme of the SCREENS being modeled,
  // independent of the editor's own theme. See §7 Theming.
  theme: z.enum(FLOW_THEMES).default('light'),

  // Defaults below let a minimal flow declare just id + name. Structural
  // validation (E2 / §6 Layer 1) enforces meaningful constraints (Entry
  // present, every path terminates, etc.) at a higher layer.
  context: ContextSchema.default({}),
  nodes: z.array(NodeSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  annotations: z.array(AnnotationSchema).default([]),
  scenarios: z.array(ScenarioSchema).default([]),
});

export type Flow = z.infer<typeof FlowSchema>;
