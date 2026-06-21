export const DSL_VERSION = '0.0.0';

export { type Diagnostic, type DiagnosticCode, type ParseResult, parse } from './parser/index.ts';
export * from './schema/index.ts';
export { serialize } from './serializer/index.ts';
export * from './vocabulary.ts';
