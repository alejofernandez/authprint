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
          warnings.push(note('vocabulary-unknown-screen-kind', node.kind, path, node.id));
        }
        node.fields.forEach((field, fi) => {
          const fpath = `nodes[${i}].fields[${fi}].type`;
          if (!isBuiltinFieldType(field.type)) {
            warnings.push(note('vocabulary-unknown-field-type', field.type, fpath, node.id));
          }
        });
        break;
      case 'decision':
        if (!isBuiltinDecisionKind(node.kind)) {
          warnings.push(note('vocabulary-unknown-decision-kind', node.kind, path, node.id));
        }
        break;
      case 'action':
        if (!isBuiltinActionKind(node.kind)) {
          warnings.push(note('vocabulary-unknown-action-kind', node.kind, path, node.id));
        }
        break;
      case 'external':
        if (!isBuiltinExternalKind(node.kind)) {
          warnings.push(note('vocabulary-unknown-external-kind', node.kind, path, node.id));
        }
        break;
      case 'outcome':
        if (!isBuiltinOutcomeKind(node.kind)) {
          warnings.push(note('vocabulary-unknown-outcome-kind', node.kind, path, node.id));
        }
        break;
      case 'entry':
        // no kind to check
        break;
    }
  });

  return warnings;
}

// `info`, not `warning`: these values are *accepted*. Flagging something the
// tool takes happily as a problem is what users pushed back on (USABILITY
// UF-005, then UF-043 from peer testing). The message already said "this is a
// custom kind"; the severity was the part still calling it a defect.
//
// When E41 lands a `vocabulary:` declaration block (ADR 0002), *undeclared*
// non-built-ins may earn `warning` back, since a typo will then be
// distinguishable from a deliberate custom value. Declared ones go silent.
function note(code: DiagnosticCode, value: string, path: string, nodeId: string): Diagnostic {
  const noun = code === 'vocabulary-unknown-field-type' ? 'field type' : 'kind';
  return {
    severity: 'info',
    code,
    message: `'${value}' is a custom ${noun} (not in the built-in vocabulary)`,
    path,
    target: { kind: 'node', id: nodeId },
  };
}
