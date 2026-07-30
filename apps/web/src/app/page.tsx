import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Editor, type PatternFlow } from '@/components/canvas/Editor';
import { emptyFlow } from '@/components/canvas/emptyFlow';
import { flowFromSource } from '@/components/canvas/flowFromSource';

// Bundled starter flows from @authprint/dsl-spec. Parsed at build time and baked
// into this static route — no filesystem access at request time. `process.cwd()`
// is the app root under Next; monorepo layout is fixed.
const EXAMPLES_DIR = join(process.cwd(), '../../packages/dsl-spec/examples');
const PATTERNS_DIR = join(EXAMPLES_DIR, 'patterns');

type PatternFileEntry = { file: string; dir: string; isDemo?: boolean };

// Demo Flow Zero stays the flagship. The three patterns beneath it are the
// real-world flows Alejo authored in the tool itself, which replaced the six
// hand-written starters. `passkey-enrollment` and `magic-link-signin` remain in
// `dsl-spec/examples` as documented spec examples; they just no longer appear as
// starting points here.
const PATTERN_FILES: PatternFileEntry[] = [
  { file: 'demo-flow-zero.authprint', dir: EXAMPLES_DIR, isDemo: true },
  { file: 'airbnb-style-unified-login-signup.authprint', dir: PATTERNS_DIR },
  { file: 'passwordless-with-otp-and-passkeys.authprint', dir: PATTERNS_DIR },
  { file: 'x-style-passwordless-with-password-fallback.authprint', dir: PATTERNS_DIR },
];

async function loadPatterns(): Promise<PatternFlow[]> {
  return Promise.all(
    PATTERN_FILES.map(async ({ file, dir, isDemo }) => {
      const source = await readFile(join(dir, file), 'utf8');
      const { flow } = flowFromSource(source);
      return {
        id: file.replace('.authprint', ''),
        name: flow?.name ?? file,
        source,
        ...(isDemo ? { isDemo: true } : {}),
      };
    }),
  );
}

export default async function HomePage() {
  const patterns = await loadPatterns();
  return <Editor initialFlow={emptyFlow} patterns={patterns} />;
}
