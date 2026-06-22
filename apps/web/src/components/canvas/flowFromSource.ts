// Parse + structurally validate `.authprint` source into a Flow.
//
// One entry point for both load paths: the Server-Component default flow
// (US-031) and user-supplied files dropped into the browser (US-032). Parse
// errors short-circuit (no Flow to validate); otherwise parser diagnostics
// (e.g. vocabulary warnings) and validator diagnostics are merged so callers
// see every issue at once.

import { type Diagnostic, type Flow, parse, validate } from '@authprint/dsl';

export type FlowFromSourceResult = {
  flow: Flow | null;
  diagnostics: Diagnostic[];
};

export function flowFromSource(source: string): FlowFromSourceResult {
  const { flow, diagnostics } = parse(source);
  if (!flow) return { flow: null, diagnostics };

  return { flow, diagnostics: [...diagnostics, ...validate(flow)] };
}
