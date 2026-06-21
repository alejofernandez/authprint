import { z } from 'zod';
import type { Node } from './node.ts';

// ─── Trigger union ──────────────────────────────────────────────────────────
// Triggers are typed by the structural type of their source node. The shape
// per source is in REQUIREMENTS.md §5 Edges; semantic mapping is enforced by
// `validateEdgeTrigger` below (the schema accepts any trigger; flow-level
// validation pairs trigger with source node and checks compatibility).

export const UnconditionalTriggerSchema = z.object({
  type: z.literal('unconditional'),
});

export const InteractionTriggerSchema = z.object({
  type: z.literal('interaction'),
  // Accepts any string at parse time. User actions are extensible (see
  // USER_ACTIONS_BUILTIN); the validator emits warnings for unknown labels.
  action: z.string().min(1),
});

export const BranchTriggerSchema = z.object({
  type: z.literal('branch'),
  // v1 predicates produce boolean outcomes (single comparison). Enum-branch
  // decisions are a v2 extension; widen to z.union([z.boolean(), z.string()])
  // when that arrives.
  value: z.boolean(),
});

export const OnSuccessTriggerSchema = z.object({ type: z.literal('on-success') });
export const OnErrorTriggerSchema = z.object({ type: z.literal('on-error') });
export const OnDeniedTriggerSchema = z.object({ type: z.literal('on-denied') });
export const OnCancelledTriggerSchema = z.object({ type: z.literal('on-cancelled') });

export const TriggerSchema = z.discriminatedUnion('type', [
  UnconditionalTriggerSchema,
  InteractionTriggerSchema,
  BranchTriggerSchema,
  OnSuccessTriggerSchema,
  OnErrorTriggerSchema,
  OnDeniedTriggerSchema,
  OnCancelledTriggerSchema,
]);

export type Trigger = z.infer<typeof TriggerSchema>;

// ─── Edge ───────────────────────────────────────────────────────────────────

export const EdgeSchema = z
  .object({
    id: z.string().min(1),
    source: z.string().min(1),
    target: z.string().min(1),
    trigger: TriggerSchema,
    label: z.string().optional(),
  })
  .refine((edge) => edge.source !== edge.target, {
    message: 'self-loops are not allowed in v1 (source must differ from target)',
    path: ['target'],
  });

export type Edge = z.infer<typeof EdgeSchema>;

// ─── Trigger-by-source-type validation ──────────────────────────────────────
// "Valid by construction" per §5: trigger type must be compatible with the
// source node's structural type. Schema accepts any trigger; flow-level
// validation calls `validateEdgeTrigger` with the resolved source node type.

const VALID_TRIGGERS_BY_SOURCE_TYPE: Record<Node['type'], readonly Trigger['type'][]> = {
  entry: ['unconditional'],
  screen: ['interaction'],
  decision: ['branch'],
  action: ['on-success', 'on-error'],
  external: ['on-success', 'on-error', 'on-denied', 'on-cancelled'],
  // outcomes are terminal — no outgoing edges allowed
  outcome: [],
};

export type EdgeValidationError = {
  edgeId: string;
  reason: string;
};

/**
 * Verify an edge's trigger is compatible with its source node's structural
 * type. Returns null if valid, a structured error if not.
 *
 * Does NOT verify that source/target IDs resolve to real nodes in the flow —
 * that's the responsibility of the flow-level validator (E2 / §6 Layer 1).
 */
export function validateEdgeTrigger(
  edge: Edge,
  sourceType: Node['type'],
): EdgeValidationError | null {
  const allowed = VALID_TRIGGERS_BY_SOURCE_TYPE[sourceType];
  if (allowed.length === 0) {
    return {
      edgeId: edge.id,
      reason: `${sourceType} nodes cannot have outgoing edges`,
    };
  }
  if (!allowed.includes(edge.trigger.type)) {
    return {
      edgeId: edge.id,
      reason: `trigger '${edge.trigger.type}' is not valid for ${sourceType} (allowed: ${allowed.join(', ')})`,
    };
  }
  return null;
}
