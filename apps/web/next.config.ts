import type { NextConfig } from 'next';

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
    ];
  },
};

export default nextConfig;
