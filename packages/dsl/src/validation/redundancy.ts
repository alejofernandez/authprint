// Redundancy lints (US-128). Not defects — things the author can tidy. These
// are `info`: the flow is legal and runnable, and an accepted construct has no
// business decorating the canvas (see DiagnosticSeverity).

import type { Diagnostic } from '../diagnostic.ts';
import type { Flow } from '../schema/flow.ts';
import { actionForLinkTrait } from '../vocabulary.ts';

/**
 * A screen carrying a link trait *and* the action that trait stands for says
 * the same thing twice: `alternative-method-link` renders "Try another way"
 * beside a `try-another-method` action rendering "Try another method".
 *
 * The edge wins (§5: traits add no transitions, so the modelled one is the
 * real affordance), renderers drop the trait's chrome, and this lint tells the
 * author the trait is now doing nothing.
 */
export function checkRedundantLinkTraits(flow: Flow): Diagnostic[] {
  const out: Diagnostic[] = [];

  for (const [idx, node] of flow.nodes.entries()) {
    if (node.type !== 'screen' || node.traits.length === 0) continue;

    const actions = new Set(
      flow.edges
        .filter((e) => e.source === node.id && e.trigger.type === 'interaction')
        .map((e) => (e.trigger.type === 'interaction' ? e.trigger.action : '')),
    );
    if (actions.size === 0) continue;

    for (const [traitIdx, trait] of node.traits.entries()) {
      const paired = actionForLinkTrait(trait);
      if (!paired || !actions.has(paired)) continue;
      out.push({
        severity: 'info',
        code: 'validation-redundant-link-trait',
        message: `screen '${node.id}' has the '${trait}' trait and a '${paired}' action; the action is the one the flow follows, so the trait adds nothing`,
        path: `nodes[${idx}].traits[${traitIdx}]`,
        target: { kind: 'node', id: node.id },
      });
    }
  }

  return out;
}
