import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Editor, type ExampleFlow, type PatternFlow } from '@/components/canvas/Editor';
import { emptyFlow } from '@/components/canvas/emptyFlow';
import { flowFromSource } from '@/components/canvas/flowFromSource';

// The bundled examples shipped in @authprint/dsl-spec. We read them from the
// sibling package and parse at build time — the sources are baked into the
// statically rendered route, so there's no filesystem access at request time.
// `process.cwd()` is the app root under Next (dev, build, and start), and the
// monorepo layout (`apps/web` + `packages/*`) is fixed; we can't use
// `require.resolve`/`import.meta.url` here because Turbopack virtualizes those
// to non-filesystem `[project]/…` paths.
const EXAMPLES_DIR = join(process.cwd(), '../../packages/dsl-spec/examples');
const PATTERNS_DIR = join(EXAMPLES_DIR, 'patterns');

// Loadable from the command palette (⌘K → Open example).
const EXAMPLE_FILES = [
  'demo-flow-zero.authprint',
  'passkey-enrollment.authprint',
  'magic-link-signin.authprint',
];

// Starter flows for ⌘K → "New flow from pattern".
const PATTERN_FILES: { file: string; dir: string }[] = [
  { file: 'social-account-link.authprint', dir: PATTERNS_DIR },
  { file: 'step-up-mfa.authprint', dir: PATTERNS_DIR },
  { file: 'email-password-verification.authprint', dir: PATTERNS_DIR },
  { file: 'passkey-enrollment.authprint', dir: EXAMPLES_DIR },
  { file: 'magic-link-signin.authprint', dir: EXAMPLES_DIR },
];

async function loadBundledFlows(entries: { file: string; dir: string }[]): Promise<ExampleFlow[]> {
  return Promise.all(
    entries.map(async ({ file, dir }) => {
      const source = await readFile(join(dir, file), 'utf8');
      const { flow } = flowFromSource(source);
      return { id: file.replace('.authprint', ''), name: flow?.name ?? file, source };
    }),
  );
}

async function loadExamples(): Promise<ExampleFlow[]> {
  return loadBundledFlows(EXAMPLE_FILES.map((file) => ({ file, dir: EXAMPLES_DIR })));
}

async function loadPatterns(): Promise<PatternFlow[]> {
  return loadBundledFlows(PATTERN_FILES);
}

export default async function HomePage() {
  const [examples, patterns] = await Promise.all([loadExamples(), loadPatterns()]);
  return <Editor initialFlow={emptyFlow} examples={examples} patterns={patterns} />;
}
