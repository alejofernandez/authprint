// Parser: YAML text → Flow.
//
// Pipeline: yaml.parseDocument (strict 1.2) → reject anchors/aliases → toJS
// → FlowSchema (zod) → vocabulary check (warnings only).
//
// The on-disk root IS a Flow — there is no wrapper key.
//
// Position-rich diagnostics from zod errors are deferred to a v1.x pass;
// for now diagnostics carry a JSONPath-style location string from zod.

import { isAlias, isMap, isNode, isPair, isScalar, isSeq, parseDocument } from 'yaml';
import type { Diagnostic } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import { FlowSchema } from '../schema/flow.ts';
import { checkVocabulary } from '../validation/vocabulary.ts';

export type ParseResult = {
  flow: Flow | null;
  diagnostics: Diagnostic[];
};

export function parse(input: string): ParseResult {
  const diagnostics: Diagnostic[] = [];

  // 1. YAML parse with strict 1.2.
  const doc = parseDocument(input, {
    version: '1.2',
    strict: true,
    merge: false,
  });

  for (const err of doc.errors) {
    diagnostics.push({
      severity: 'error',
      code: 'yaml-parse-error',
      message: err.message,
    });
  }
  for (const warn of doc.warnings) {
    diagnostics.push({
      severity: 'warning',
      code: 'yaml-parse-error',
      message: warn.message,
    });
  }

  if (doc.errors.length > 0) {
    return { flow: null, diagnostics };
  }

  // 2. Reject anchors and aliases. Walk every node in the document.
  const anchorAliasErrors = collectAnchorAndAliasErrors(doc.contents);
  diagnostics.push(...anchorAliasErrors);
  if (anchorAliasErrors.some((d) => d.severity === 'error')) {
    return { flow: null, diagnostics };
  }

  // 3. Convert to plain JS for zod.
  const raw = doc.toJS();

  // 4. Schema validation. The document root IS a Flow.
  const parsed = FlowSchema.safeParse(raw);
  if (!parsed.success) {
    for (const issue of parsed.error.issues) {
      diagnostics.push({
        severity: 'error',
        code: 'schema-violation',
        message: issue.message,
        path: issue.path.length > 0 ? formatPath(issue.path) : undefined,
      });
    }
    return { flow: null, diagnostics };
  }

  // 5. Vocabulary check (warnings only — custom kinds are allowed). Shared
  //    with the standalone validator (validation/vocabulary.ts).
  diagnostics.push(...checkVocabulary(parsed.data));

  return {
    flow: parsed.data,
    diagnostics,
  };
}

// ─── Anchor / alias walker ──────────────────────────────────────────────────

function collectAnchorAndAliasErrors(contents: unknown): Diagnostic[] {
  const errors: Diagnostic[] = [];

  const visit = (node: unknown): void => {
    if (!isNode(node) && !isPair(node)) return;

    if (isAlias(node)) {
      errors.push({
        severity: 'error',
        code: 'yaml-alias-rejected',
        message: 'YAML aliases are not allowed in Authprint flows',
      });
      return;
    }

    if (isScalar(node) || isMap(node) || isSeq(node)) {
      if ('anchor' in node && node.anchor) {
        errors.push({
          severity: 'error',
          code: 'yaml-anchor-rejected',
          message: `YAML anchor '&${node.anchor}' is not allowed in Authprint flows`,
        });
      }
    }

    if (isMap(node)) {
      for (const item of node.items) {
        visit(item);
      }
    } else if (isSeq(node)) {
      for (const item of node.items) {
        visit(item);
      }
    } else if (isPair(node)) {
      visit(node.key);
      visit(node.value);
    }
  };

  visit(contents);
  return errors;
}

// ─── Path formatting ────────────────────────────────────────────────────────

function formatPath(path: ReadonlyArray<string | number | symbol>): string {
  let out = '';
  for (const seg of path) {
    if (typeof seg === 'number') {
      out += `[${seg}]`;
    } else if (typeof seg === 'string') {
      out += out.length === 0 ? seg : `.${seg}`;
    }
  }
  return out;
}

// Re-export the types for consumers.
export type { Flow };
