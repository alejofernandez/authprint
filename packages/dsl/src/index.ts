export const DSL_VERSION = '0.0.0';

export * from './diagnostic.ts';
export { type ParseResult, parse } from './parser/index.ts';
export * from './schema/index.ts';
export { serialize } from './serializer/index.ts';
export { canExport, validate } from './validation/index.ts';
export * from './vocabulary.ts';
