import { z } from 'zod';
import { PREDICATE_OPS, SLOT_TYPES } from '../vocabulary.ts';

// ─── Context ────────────────────────────────────────────────────────────────
// A Flow declares a Context: a typed slot bag. Slots are declarations only;
// runtime values exist only inside Scenarios. See REQUIREMENTS.md §5.

export const ContextSlotSchema = z
  .object({
    type: z.enum(SLOT_TYPES),
    values: z.array(z.string()).optional(),
  })
  .refine((slot) => slot.type !== 'enum' || (slot.values && slot.values.length > 0), {
    message: "enum slot type requires non-empty 'values' array",
    path: ['values'],
  });

export type ContextSlot = z.infer<typeof ContextSlotSchema>;

// Context is a flat record: slot name → declaration. No `slots:` wrapper —
// reads cleaner in YAML (see vocabulary.md / grammar discussion).
export const ContextSchema = z.record(z.string().min(1), ContextSlotSchema);
export type Context = z.infer<typeof ContextSchema>;

// ─── Predicate ──────────────────────────────────────────────────────────────
// v1 = single typed comparison (REQUIREMENTS.md §5 Context and conditions).
// AND/OR/NOT composition deferred.

export const PredicateSchema = z.object({
  slot: z.string().min(1),
  op: z.enum(PREDICATE_OPS),
  // value type depends on referenced slot's type; cross-validation happens at
  // a higher layer (validator) once it can look slots up.
  value: z.unknown(),
});

export type Predicate = z.infer<typeof PredicateSchema>;
