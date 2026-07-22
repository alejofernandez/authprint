import type { ActionNode, ExternalNode } from './schema/node.ts';

/** Node whose failure can supply error-banner copy during scenario playback. */
export type ErrorBannerSource = Pick<ActionNode | ExternalNode, 'type' | 'name' | 'errorMessage'>;

export const ERROR_BANNER_PLACEHOLDER = 'Something went wrong. Try again.';

/**
 * Fallback chain for inline error-banner copy: scenario-step override, then
 * the node's authored errorMessage, then derived, then placeholder. The
 * override lets a failure scenario say exactly what the user would read.
 */
export function resolveErrorBannerCopy(
  failingNode: ErrorBannerSource | null,
  scenarioMessage?: string | null,
): string {
  if (scenarioMessage) return scenarioMessage;
  if (failingNode?.errorMessage) return failingNode.errorMessage;
  if (failingNode?.name) return `${failingNode.name} failed`;
  return ERROR_BANNER_PLACEHOLDER;
}
