import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { Editor } from '@/components/canvas/Editor';
import { flowFromSource } from '@/components/canvas/flowFromSource';

// Demo Flow Zero is the canonical example shipped in @authprint/dsl-spec. We
// read it from the sibling package and parse it at build time — the parsed Flow
// is baked into the statically rendered route, so there's no filesystem access
// at request time. `process.cwd()` is the app root under Next (dev, build, and
// start), and the monorepo layout (`apps/web` + `packages/*`) is fixed; we
// can't use `require.resolve`/`import.meta.url` here because Turbopack
// virtualizes those to non-filesystem `[project]/…` paths.
const DEMO_FLOW_PATH = join(
  process.cwd(),
  '../../packages/dsl-spec/examples/demo-flow-zero.authprint',
);

async function loadDemoFlow() {
  return flowFromSource(await readFile(DEMO_FLOW_PATH, 'utf8'));
}

export default async function HomePage() {
  const { flow, diagnostics } = await loadDemoFlow();

  if (!flow) {
    return (
      <main className="grid h-dvh place-items-center bg-zinc-50 p-8 dark:bg-zinc-950">
        <div className="max-w-lg space-y-3">
          <h1 className="font-semibold text-lg text-zinc-900 dark:text-zinc-100">
            Couldn’t load the demo flow
          </h1>
          <ul className="space-y-1 font-mono text-red-600 text-sm dark:text-red-400">
            {diagnostics.map((d) => (
              <li key={`${d.code}:${d.path ?? ''}`}>
                {d.path ? `${d.path} — ` : ''}
                {d.message}
              </li>
            ))}
          </ul>
        </div>
      </main>
    );
  }

  return <Editor flow={flow} />;
}
