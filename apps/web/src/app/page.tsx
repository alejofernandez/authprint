import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Editor, type ExampleFlow } from '@/components/canvas/Editor';
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

// Loadable from the command palette (⌘K → Open example).
const EXAMPLE_FILES = [
  'demo-flow-zero.authprint',
  'passkey-enrollment.authprint',
  'magic-link-signin.authprint',
];

async function loadExamples(): Promise<ExampleFlow[]> {
  return Promise.all(
    EXAMPLE_FILES.map(async (file) => {
      const source = await readFile(join(EXAMPLES_DIR, file), 'utf8');
      const { flow } = flowFromSource(source);
      return { id: file.replace('.authprint', ''), name: flow?.name ?? file, source };
    }),
  );
}

export default async function HomePage() {
  const examples = await loadExamples();
  return <Editor initialFlow={emptyFlow} examples={examples} />;
}
