import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // React Compiler is disabled: React Flow 12.x ships no `'use no memo'` opt-out
  // directives, so the compiler mangles its internal hooks (breaking `fitView`
  // and flooding "deps changed size" errors). React Flow is the editor's core,
  // so correctness wins. Revisit when React Flow ships compiler-safe builds.
  reactCompiler: false,
};

export default nextConfig;
