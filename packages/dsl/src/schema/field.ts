import { z } from 'zod';

// Field type is accepted as any string at parse time; the validator layer
// warns when a value is not in FIELD_TYPES_BUILTIN. See vocabulary.ts.
export const FieldSchema = z.object({
  name: z.string().min(1),
  type: z.string().min(1),
  required: z.boolean(),
});

export type Field = z.infer<typeof FieldSchema>;
