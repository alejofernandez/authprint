import { z } from 'zod';
import { TRAIT_IDS } from '../vocabulary.ts';
import {
  BOUND,
  IdString,
  NameString,
  OptionalErrorMessageString,
  OptionalNameString,
  OptionalNotesString,
} from './bounds.ts';
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
  id: IdString,
});
export type EntryNode = z.infer<typeof EntryNodeSchema>;

// ─── Screen ─────────────────────────────────────────────────────────────────
// User-facing step. Three-layer anatomy (kind + traits + fields).

export const ScreenNodeSchema = z.object({
  type: z.literal('screen'),
  id: IdString,
  name: NameString,
  kind: IdString,
  // Defaults match the serializer's "omit when at default" behavior, so a
  // minimal Screen declaration round-trips cleanly.
  traits: z.array(z.enum(TRAIT_IDS)).default([]),
  fields: z.array(FieldSchema).max(BOUND.fields).default([]),
  // `fidelity` was removed (US-124). Zod's default object behavior strips
  // unknown keys, so legacy `fidelity: …` lines parse cleanly and are dropped.
});
export type ScreenNode = z.infer<typeof ScreenNodeSchema>;

// ─── Decision ───────────────────────────────────────────────────────────────
// Branches on a predicate over Context. No UI. Name optional (kind often
// implies a clear name).

export const DecisionNodeSchema = z.object({
  type: z.literal('decision'),
  id: IdString,
  name: OptionalNameString,
  kind: IdString,
  predicate: PredicateSchema,
});
export type DecisionNode = z.infer<typeof DecisionNodeSchema>;

// ─── Action ─────────────────────────────────────────────────────────────────
// Server-side step. Outgoing edges must include both on-success and on-error
// (enforced by structural validation, not schema).

export const ActionNodeSchema = z.object({
  type: z.literal('action'),
  id: IdString,
  name: NameString,
  kind: IdString,
  errorMessage: OptionalErrorMessageString,
  // Optional free-text notes (markdown subset). Absent and empty are the same
  // on write: never serialize `notes: ''`.
  notes: OptionalNotesString,
});
export type ActionNode = z.infer<typeof ActionNodeSchema>;

// ─── External ───────────────────────────────────────────────────────────────
// Hand-off to an external system. Distinguished from Action because the
// visual treatment must communicate "you leave the flow and return."

export const ExternalNodeSchema = z.object({
  type: z.literal('external'),
  id: IdString,
  name: NameString,
  kind: IdString,
  errorMessage: OptionalErrorMessageString,
  notes: OptionalNotesString,
});
export type ExternalNode = z.infer<typeof ExternalNodeSchema>;

// ─── Outcome ────────────────────────────────────────────────────────────────
// Terminal state. Multiple per flow allowed.

export const OutcomeNodeSchema = z.object({
  type: z.literal('outcome'),
  id: IdString,
  name: NameString,
  kind: IdString,
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
