import type { NextConfig } from 'next';
import createNextIntlPlugin from 'next-intl/plugin';

const withNextIntl = createNextIntlPlugin();

const nextConfig: NextConfig = {
  // React Compiler is disabled: React Flow 12.x ships no `'use no memo'` opt-out
  // directives, so the compiler mangles its internal hooks (breaking `fitView`
  // and flooding "deps changed size" errors). React Flow is the editor's core,
  // so correctness wins. Revisit when React Flow ships compiler-safe builds.
  reactCompiler: false,
  output: 'standalone',
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
          // TODO(E14 CSP): Content Security Policy requires dynamic nonces; implement via middleware.
        ],
      },
      {
        // Next.js sets a long-lived `s-maxage` on statically-prerendered pages by
        // default (safe on Vercel, which invalidates the CDN cache per deploy).
        // We're self-hosted behind Firebase Hosting's CDN with no equivalent
        // invalidation, so a redeploy silently left Firebase serving a stale HTML
        // shell referencing a previous build's now-gone chunk hashes — breaking
        // all client-side interactivity while `/` still returned 200 (E11 v0,
        // discovered via US-098's ⌘0 overlay not firing in prod). Explicitly
        // override to no-store for every route except the content-hashed,
        // genuinely-immutable `/_next/static/*` assets, which keep Next's default
        // long-lived caching.
        source: '/((?!_next/static/).*)',
        headers: [
          {
            key: 'Cache-Control',
            value: 'no-store',
          },
        ],
      },
    ];
  },
};

export default withNextIntl(nextConfig);
