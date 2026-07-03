import { z } from 'zod';
import { ANNOTATION_KINDS } from '../vocabulary.ts';

// Annotations are sticky-note style notes. They attach to a node, an
// edge, or float on the canvas. They are NOT comments — comments are a v1.5
// collaboration feature with their own entity.

export const NodeAttachmentSchema = z.object({
  type: z.literal('node'),
  nodeId: z.string().min(1),
});

export const EdgeAttachmentSchema = z.object({
  type: z.literal('edge'),
  edgeId: z.string().min(1),
});

export const FloatingAttachmentSchema = z.object({
  type: z.literal('floating'),
  x: z.number(),
  y: z.number(),
});

export const AnnotationAttachmentSchema = z.discriminatedUnion('type', [
  NodeAttachmentSchema,
  EdgeAttachmentSchema,
  FloatingAttachmentSchema,
]);

export type AnnotationAttachment = z.infer<typeof AnnotationAttachmentSchema>;

export const AnnotationSchema = z.object({
  id: z.string().min(1),
  kind: z.enum(ANNOTATION_KINDS),
  text: z.string().min(1),
  attachment: AnnotationAttachmentSchema,
});

export type Annotation = z.infer<typeof AnnotationSchema>;
