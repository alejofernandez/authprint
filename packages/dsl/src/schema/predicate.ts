import { z } from 'zod';
import { PREDICATE_OPS, SLOT_TYPES } from '../vocabulary.ts';
import {
  BOUND,
  ContextScalarValueSchema,
  IdString,
  maxRecordKeys,
  PredicateValueSchema,
} from './bounds.ts';

// ─── Context ────────────────────────────────────────────────────────────────
// A Flow declares a Context: a typed slot bag. Slots are declarations only;
// runtime values exist only inside Scenarios.

export const ContextSlotSchema = z
  .object({
    type: z.enum(SLOT_TYPES),
    values: z.array(IdString).max(BOUND.enumValues).optional(),
  })
  .refine((slot) => slot.type !== 'enum' || (slot.values && slot.values.length > 0), {
    message: "enum slot type requires non-empty 'values' array",
    path: ['values'],
  });

export type ContextSlot = z.infer<typeof ContextSlotSchema>;

// Context is a flat record: slot name → declaration. No `slots:` wrapper —
// reads cleaner in YAML (see vocabulary.md / grammar discussion).
export const ContextSchema = maxRecordKeys(
  z.record(IdString, ContextSlotSchema),
  BOUND.contextSlots,
  'context',
);
export type Context = z.infer<typeof ContextSchema>;

// ─── Predicate ──────────────────────────────────────────────────────────────
// v1 = single typed comparison.
// AND/OR/NOT composition deferred.

export const PredicateSchema = z.object({
  slot: IdString,
  op: z.enum(PREDICATE_OPS),
  // Scalars always; arrays of scalars for `in` / `not-in`. Objects rejected.
  // Type-vs-slot cross-check stays in the validator.
  value: PredicateValueSchema,
});

export type Predicate = z.infer<typeof PredicateSchema>;

export { ContextScalarValueSchema, PredicateValueSchema };
