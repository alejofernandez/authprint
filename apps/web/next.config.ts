import path from 'node:path';
import { fileURLToPath } from 'node:url';
import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';
import { contentSecurityPolicy } from './contentSecurityPolicy.ts';

const withNextIntl = createNextIntlPlugin();

// Worktrees sit under `.worktrees/<branch>/`; Next otherwise climbs to the
// parent checkout's bun.lock and treats that as the Turbopack root, which can
// silently resolve workspace packages from `main` while this app runs.
const monorepoRoot = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const nextConfig: NextConfig = {
  // React Compiler is disabled: React Flow 12.x ships no `'use no memo'` opt-out
  // directives, so the compiler mangles its internal hooks (breaking `fitView`
  // and flooding "deps changed size" errors). React Flow is the editor's core,
  // so correctness wins. Revisit when React Flow ships compiler-safe builds.
  reactCompiler: false,
  output: 'standalone',
  turbopack: {
    root: monorepoRoot,
  },
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          {
            key: 'Strict-Transport-Security',
            value: 'max-age=63072000; includeSubDomains; preload',
          },
          {
            key: 'X-Content-Type-Options',
            value: 'nosniff',
          },
          {
            key: 'Referrer-Policy',
            value: 'strict-origin-when-cross-origin',
          },
          {
            key: 'X-Frame-Options',
            value: 'DENY',
          },
          {
            key: 'Cross-Origin-Opener-Policy',
            value: 'same-origin',
          },
          {
            key: 'Permissions-Policy',
            value: 'camera=(), microphone=(), geolocation=()',
          },
          {
            key: 'X-DNS-Prefetch-Control',
            value: 'off',
          },
          {
            // US-141: nonce-free CSP. `script-src` keeps `'unsafe-inline'` on
            // purpose (THEME_INIT_SCRIPT + Next bootstraps); closing it is
            // US-142 and costs the edge cache. `img-src` / `connect-src` are
            // the exfil fence for untrusted note markdown — see
            // contentSecurityPolicy.ts.
            key: 'Content-Security-Policy',
            value: contentSecurityPolicy({ isDev: process.env.NODE_ENV === 'development' }),
          },
        ],
      },
      {
        // API routes are never edge-cached — always fresh, no shared-cache window.
        // Kept separate from the document rule below so future auth/Firestore-backed
        // routes don't inherit page-level caching by accident.
        source: '/api/:path*',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
      {
        // Next.js sets a year-long `s-maxage` on statically-prerendered pages by
        // default (safe on Vercel, which invalidates its CDN per deploy). We're
        // self-hosted behind an edge CDN with no equivalent mechanism — a
        // redeploy once left the CDN serving a stale HTML shell referencing a
        // previous build's now-gone chunk hashes, breaking all client-side
        // hydration while `/` still returned 200 (E11 v0, first surfaced via
        // US-098's ⌘0 overlay not firing in prod).
        //
        // The document shell has no per-user server-side personalization yet
        // (everything stateful is client-side — Y.Doc, IndexedDB), so it's safe
        // to edge-cache briefly rather than disable caching outright: a short
        // `s-maxage` bounds staleness after any deploy to ~60s automatically
        // (no dependency on remembering to redeploy Hosting), and
        // `stale-while-revalidate` avoids a thundering-herd of cold origin
        // invocations right after each expiry. Revisit once server-rendered
        // per-user content exists (Phase III auth) — that content must not
        // share this cache key.
        source: '/((?!_next/static/|api/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'public, max-age=0, s-maxage=60, stale-while-revalidate=604800',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
