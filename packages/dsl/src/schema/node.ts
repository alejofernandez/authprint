import { z } from 'zod';
import { FIDELITIES, TRAIT_IDS } from '../vocabulary.ts';
import { FieldSchema } from './field.ts';
import { PredicateSchema } from './predicate.ts';

// Six closed structural types (see @authprint/dsl-spec semantics.md);
// every node carries `type` (discriminator) + `id` + per-type fields.
//
// Kind values (`kind:` on Screen/Decision/Action/External/Outcome) are
// accepted as any string at parse time; the validator warns when a value is
// not in the built-in vocabulary. Traits are a closed set, enforced here.

// ─── Entry ──────────────────────────────────────────────────────────────────
// Exactly one per flow (enforced by structural validation, not schema). No
// kind; the structural type is the whole identity.

export const EntryNodeSchema = z.object({
  type: z.literal('entry'),
  id: z.string().min(1),
});
export type EntryNode = z.infer<typeof EntryNodeSchema>;

// ─── Screen ─────────────────────────────────────────────────────────────────
// User-facing step. Three-layer anatomy (kind + traits + fields).

export const ScreenNodeSchema = z.object({
  type: z.literal('screen'),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
  // Defaults match the serializer's "omit when at default" behavior, so a
  // minimal Screen declaration round-trips cleanly.
  traits: z.array(z.enum(TRAIT_IDS)).default([]),
  fields: z.array(FieldSchema).default([]),
  fidelity: z.enum(FIDELITIES).default('lo-fi'),
});
export type ScreenNode = z.infer<typeof ScreenNodeSchema>;

// ─── Decision ───────────────────────────────────────────────────────────────
// Branches on a predicate over Context. No UI. Name optional (kind often
// implies a clear name).

export const DecisionNodeSchema = z.object({
  type: z.literal('decision'),
  id: z.string().min(1),
  name: z.string().min(1).optional(),
  kind: z.string().min(1),
  predicate: PredicateSchema,
});
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;

// ─── Action ─────────────────────────────────────────────────────────────────
// Server-side step. Outgoing edges must include both on-success and on-error
// (enforced by structural validation, not schema).

export const ActionNodeSchema = z.object({
  type: z.literal('action'),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
});
export type ActionNode = z.infer<typeof ActionNodeSchema>;

// ─── External ───────────────────────────────────────────────────────────────
// Hand-off to an external system. Distinguished from Action because the
// visual treatment must communicate "you leave the flow and return."

export const ExternalNodeSchema = z.object({
  type: z.literal('external'),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
});
export type ExternalNode = z.infer<typeof ExternalNodeSchema>;

// ─── Outcome ────────────────────────────────────────────────────────────────
// Terminal state. Multiple per flow allowed.

export const OutcomeNodeSchema = z.object({
  type: z.literal('outcome'),
  id: z.string().min(1),
  name: z.string().min(1),
  kind: z.string().min(1),
});
export type OutcomeNode = z.infer<typeof OutcomeNodeSchema>;

// ─── Discriminated union ────────────────────────────────────────────────────

export const NodeSchema = z.discriminatedUnion('type', [
  EntryNodeSchema,
  ScreenNodeSchema,
  DecisionNodeSchema,
  ActionNodeSchema,
  ExternalNodeSchema,
  OutcomeNodeSchema,
]);
export type Node = z.infer<typeof NodeSchema>;

/** Convenience: a node ID is just a string. Branded type deferred to v1.x. */
export type NodeId = string;
