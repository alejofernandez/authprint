import type { ActionNode, ExternalNode } from './schema/node.ts';

/** Node whose failure can supply error-banner copy during scenario playback. */
export type ErrorBannerSource = Pick<ActionNode | ExternalNode, 'type' | 'name' | 'errorMessage'>;

export const ERROR_BANNER_PLACEHOLDER = 'Something went wrong. Try again.';

/** Fallback chain for inline error-banner copy (static canvas + future player). */
export function resolveErrorBannerCopy(failingNode: ErrorBannerSource | null): string {
  if (failingNode?.errorMessage) return failingNode.errorMessage;
  if (failingNode?.name) return `${failingNode.name} failed`;
  return ERROR_BANNER_PLACEHOLDER;
}
