import { z } from 'zod';
import { FLOW_THEMES } from '../vocabulary.ts';
import { AnnotationSchema } from './annotation.ts';
import { EdgeSchema } from './edge.ts';
import { NodeSchema } from './node.ts';
import { ContextSchema } from './predicate.ts';
import { ScenarioSchema } from './scenario.ts';

// The top-level Flow container (see @authprint/dsl-spec semantics.md —
// Flow-level attributes).
//
// An .authprint file's root IS a Flow — there is no wrapper key. Forward-compat
// for schema-format versioning (if ever needed) will use a top-level
// `apiVersion: authprint/vN` field (Kubernetes-style), not a nested wrapper.

// Presentation identity for the product the flow belongs to — feeds mockup-tier
// screen rendering (brand block + CTA color on Screen previews) and the
// light/dark rendering mode of the screens being modeled, independent of the
// editor's own theme. Grouped under one object rather than
// scattered Flow scalars because these all answer "how does this flow's
// screens look" — the same grouping Auth0/Stripe use for their own branding
// settings, and the natural home for a future `logoUrl`. Flow-scoped, not the
// tool-level "per-workspace branding", which is deliberately out of scope for v1.
// `theme` always resolves (default 'light'); companyName/primaryColor are
// independently optional — an unset Flow renders screens with the existing
// generic placeholder.
export const BrandingSchema = z.object({
  theme: z.enum(FLOW_THEMES).default('light'),
  companyName: z.string().optional(),
  primaryColor: z.string().optional(),
});

export const FlowSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  description: z.string().optional(),

  // .prefault({}) (not .default({})) so an omitted `branding` key still runs
  // through BrandingSchema's own field defaults (theme: 'light') rather than
  // becoming a bare `{}` — `flow.branding.theme` must always resolve.
  branding: BrandingSchema.prefault({}),

  // Defaults below let a minimal flow declare just id + name. Structural
  // validation (E2, layer 1) enforces meaningful constraints (Entry
  // present, every path terminates, etc.) at a higher layer.
  context: ContextSchema.default({}),
  nodes: z.array(NodeSchema).default([]),
  edges: z.array(EdgeSchema).default([]),
  annotations: z.array(AnnotationSchema).default([]),
  scenarios: z.array(ScenarioSchema).default([]),
});

export type Flow = z.infer<typeof FlowSchema>;
export type Branding = z.infer<typeof BrandingSchema>;
