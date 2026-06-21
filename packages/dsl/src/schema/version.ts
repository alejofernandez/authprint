import { z } from 'zod';

// Version metadata per REQUIREMENTS.md §5 Versions / §10 Persistence.
//
// Versions are stored separately from flow content (Firestore subcollection
// per §10 storage shape). This schema represents the metadata; the actual
// dsl+layout snapshot lives alongside as separate fields/documents.

export const VersionTypeSchema = z.enum(['auto', 'named']);

export const VersionSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  type: VersionTypeSchema,
  createdAt: z.iso.datetime(),
  createdBy: z.string().min(1),
});

export type Version = z.infer<typeof VersionSchema>;
