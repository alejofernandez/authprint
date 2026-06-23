import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Editor, type ExampleFlow } from '@/components/canvas/Editor';
import { flowFromSource } from '@/components/canvas/flowFromSource';

// The bundled examples shipped in @authprint/dsl-spec. We read them from the
// sibling package and parse at build time — the sources are baked into the
// statically rendered route, so there's no filesystem access at request time.
// `process.cwd()` is the app root under Next (dev, build, and start), and the
// monorepo layout (`apps/web` + `packages/*`) is fixed; we can't use
// `require.resolve`/`import.meta.url` here because Turbopack virtualizes those
// to non-filesystem `[project]/…` paths.
const EXAMPLES_DIR = join(process.cwd(), '../../packages/dsl-spec/examples');

// Demo Flow Zero is the default; the rest are loadable from the command palette.
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
  const demo = examples[0];
  const { flow, diagnostics } = demo
    ? flowFromSource(demo.source)
    : { flow: null, diagnostics: [] };

  if (!flow) {
    return (
      <main className="grid h-dvh place-items-center bg-zinc-50 p-8 dark:bg-zinc-950">
        <div className="max-w-lg space-y-3">
          <h1 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            Couldn’t load the demo flow
          </h1>
          <ul className="space-y-1 font-mono text-red-600 text-sm dark:text-red-400">
            {diagnostics.map((d, i) => (
              // biome-ignore lint/suspicious/noArrayIndexKey: static, never-reordered diagnostics list
              <li key={i}>
                {d.path ? `${d.path} — ` : ''}
                {d.message}
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  return <Editor initialFlow={flow} examples={examples} />;
}
