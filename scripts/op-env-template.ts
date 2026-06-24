/**
 * Validates a 1Password env template: values must be op:// references or empty.
 * Returns human-readable offender descriptions (empty = valid).
 */

function unquoteEnvValue(value: string): string {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }
  return value;
}

function isOpSecretReference(value: string): boolean {
  return unquoteEnvValue(value).startsWith('op://');
}

export function findPlaintextSecretOffenders(text: string): string[] {
  const offenders: string[] = [];

  for (const [index, line] of text.split('\n').entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const name = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim();
    if (!value) continue;
    if (isOpSecretReference(value)) continue;

    offenders.push(`line ${index + 1}: ${name}=…`);
  }

  return offenders;
}

/** Command argv after Bun/npm (which strip `--`) or after an explicit `--`. */
export function parseOpRunCommand(argv: string[]): string[] | null {
  const sep = argv.indexOf('--');
  const rest = sep === -1 ? argv : argv.slice(sep + 1);
  return rest.length > 0 ? rest : null;
}

/** Parse dotenv-style lines (output of `op inject`). */
export function parseDotenv(content: string): Record<string, string> {
  const env: Record<string, string> = {};

  for (const line of content.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;

    const key = trimmed.slice(0, eq).trim();
    if (!key) continue;

    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    env[key] = value;
  }

  return env;
}

/** Parent process env + injected secrets (secrets win on key collision). */
export function mergeChildEnv(
  parent: Record<string, string | undefined>,
  injected: Record<string, string>,
): Record<string, string> {
  const env: Record<string, string> = {};
  for (const [key, value] of Object.entries(parent)) {
    if (value !== undefined) env[key] = value;
  }
  return { ...env, ...injected };
}
