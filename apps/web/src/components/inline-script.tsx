'use client';

// A pre-paint inline <script>, following Next's "preventing flash before
// hydration" guide. On the server it renders as executable `text/javascript`,
// so the browser runs it synchronously while parsing the HTML — before first
// paint. On the client React re-renders it as inert `text/plain`, which
// silences React 19's "Encountered a script tag while rendering" dev warning
// (scripts never execute on a client render anyway); `suppressHydrationWarning`
// accepts the server/client `type` swap.
//
// Must be a Client Component: used inside the Server Component root layout, it
// has to re-render on the client for the `type` to flip to `text/plain` (a
// server render's `typeof window` is always `undefined`).
//
// Inline scripts need a CSP nonce once strict headers land — §12.
export function InlineScript({ html }: { html: string }) {
  return (
    <script
      type={typeof window === 'undefined' ? 'text/javascript' : 'text/plain'}
      suppressHydrationWarning
      // biome-ignore lint/security/noDangerouslySetInnerHtml: trusted build-time-constant bootstrap that must run before React.
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}
