import { z } from 'zod';
import { IdString } from './bounds.ts';

// Field type is accepted as any string at parse time; the validator layer
// warns when a value is not in FIELD_TYPES_BUILTIN. See vocabulary.ts.
export const FieldSchema = z.object({
  name: IdString,
  type: IdString,
  required: z.boolean(),
});

export type Field = z.infer<typeof FieldSchema>;
