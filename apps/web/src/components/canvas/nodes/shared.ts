// Shared type for the `data` payload our canvas attaches to React Flow
// nodes. Each per-structural-type view receives this wrapped in `NodeProps`.

import type { Branding, Diagnostic, Node } from '@authprint/dsl';
import type { TraceNodeState } from '../scenario/scenarioTrace.ts';
import type { ResolvedScreenTheme } from './screen/screenTheme.ts';

export type CanvasNodeData<TNode extends Node = Node> = {
  /** The original DSL node — single source of truth for rendering. */
  node: TNode;
  /** Resolved screen light/dark from Flow.branding.theme (US-070). Set on Screen nodes only. */
  screenTheme?: ResolvedScreenTheme;
  /** Flow-level branding (company name / primary color) — feeds mockup-tier
   *  screen rendering. Set on Screen nodes only. */
  branding?: Branding;
  /** Scenario trace styling (US-061). Set when walking a scenario run. */
  traceState?: TraceNodeState;
  /** Divergence tooltip for `traceState: 'diverged'`. */
  traceTooltip?: string;
  /** Live validation diagnostics targeting this node (E33). Absent = clean. */
  diagnostics?: Diagnostic[];
  /**
   * Source-handle ids that already have an outgoing edge (E26). Drives the
   * per-handle `+` affordance: a single-use handle in this set hides its `+`.
   * The unconditional (entry) handle is keyed by `''`. Absent in contexts that
   * don't compute it (e.g. Storybook) → treat as none connected.
   */
  connectedHandles?: ReadonlySet<string>;
  /** Handle whose `+` opened the type picker — keeps that button visible (UF-002). */
  pickerAnchorHandle?: string | null;
  /** Screen-reader label (US-077). Computed in flowToReactFlow. */
  ariaLabel?: string;
};
