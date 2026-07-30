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

type PatternFileEntry = { file: string; isDemo?: boolean };

// Starters are chosen for legibility, not completeness (§0 principle 7: the
// author sets the complexity, the tool never imposes it). These are the flows
// authored in the tool itself.
//
// Deliberately absent: `demo-flow-zero`, at 27 nodes and 12 outcomes against 13
// to 17 here. It is honest about real auth and it is still the wrong first
// thing a newcomer opens, because it reads as the size a flow has to be. It
// stays the canonical example in `dsl-spec` and the big realistic fixture for
// five test files, both of which want exactly that size. `passkey-enrollment`
// and `magic-link-signin` stay in `dsl-spec/examples` for the same reason.
// No entry sets `isDemo`, so no tile is subtitled "Demo". That label meant
// "Authprint's own auth flow" and would be wrong on a pattern; naming a new
// flagship is a copy decision, and the plumbing is one field away when wanted.
const PATTERN_FILES: PatternFileEntry[] = [
  { file: 'airbnb-style-unified-login-signup.authprint' },
  { file: 'passwordless-with-otp-and-passkeys.authprint' },
  { file: 'x-style-passwordless-with-password-fallback.authprint' },
];

async function loadPatterns(): Promise<PatternFlow[]> {
  return Promise.all(
    PATTERN_FILES.map(async ({ file, isDemo }) => {
      const source = await readFile(join(PATTERNS_DIR, file), 'utf8');
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
