// Vocabulary correctness check. Emits `vocabulary-unknown-*-kind` warnings
// for kind / field-type identifiers not in the built-in vocabulary. Custom
// values are allowed (per `extension model` in vocabulary.md) — these are
// warnings, not errors.
//
// Shared by the parser (called during parse) and the standalone validator
// (called over a Flow loaded from any source). Keeping a single
// implementation prevents divergence.

import type { Diagnostic, DiagnosticCode } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import {
  isBuiltinActionKind,
  isBuiltinDecisionKind,
  isBuiltinExternalKind,
  isBuiltinFieldType,
  isBuiltinOutcomeKind,
  isBuiltinScreenKind,
} from '../vocabulary.ts';

export function checkVocabulary(flow: Flow): Diagnostic[] {
  const warnings: Diagnostic[] = [];

  flow.nodes.forEach((node, i) => {
    const path = `nodes[${i}].kind`;
    switch (node.type) {
      case 'screen':
        if (!isBuiltinScreenKind(node.kind)) {
          warnings.push(warn('vocabulary-unknown-screen-kind', node.kind, path));
        }
        node.fields.forEach((field, fi) => {
          const fpath = `nodes[${i}].fields[${fi}].type`;
          if (!isBuiltinFieldType(field.type)) {
            warnings.push(warn('vocabulary-unknown-field-type', field.type, fpath));
          }
        });
        break;
      case 'decision':
        if (!isBuiltinDecisionKind(node.kind)) {
          warnings.push(warn('vocabulary-unknown-decision-kind', node.kind, path));
        }
        break;
      case 'action':
        if (!isBuiltinActionKind(node.kind)) {
          warnings.push(warn('vocabulary-unknown-action-kind', node.kind, path));
        }
        break;
      case 'external':
        if (!isBuiltinExternalKind(node.kind)) {
          warnings.push(warn('vocabulary-unknown-external-kind', node.kind, path));
        }
        break;
      case 'outcome':
        if (!isBuiltinOutcomeKind(node.kind)) {
          warnings.push(warn('vocabulary-unknown-outcome-kind', node.kind, path));
        }
        break;
      case 'entry':
        // no kind to check
        break;
    }
  });

  return warnings;
}

function warn(code: DiagnosticCode, value: string, path: string): Diagnostic {
  return {
    severity: 'warning',
    code,
    message: `'${value}' is not in the built-in vocabulary (accepted as custom)`,
    path,
  };
}
