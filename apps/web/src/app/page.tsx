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

const PATTERN_FILES: PatternFileEntry[] = [
  { file: 'demo-flow-zero.authprint', dir: EXAMPLES_DIR, isDemo: true },
  { file: 'social-account-link.authprint', dir: PATTERNS_DIR },
  { file: 'step-up-mfa.authprint', dir: PATTERNS_DIR },
  { file: 'email-password-verification.authprint', dir: PATTERNS_DIR },
  { file: 'passkey-enrollment.authprint', dir: EXAMPLES_DIR },
  { file: 'magic-link-signin.authprint', dir: EXAMPLES_DIR },
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
