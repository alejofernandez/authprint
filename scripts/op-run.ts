#!/usr/bin/env bun
/**
 * Run a command with secrets from 1Password — no plaintext .env on disk.
 *
 * Resolves op:// references via `op inject` (in memory), merges into the child
 * process environment, then execs the command. Nothing is written to disk.
 *
 * Usage:
 *   bun run op:run -- bun run dev
 *   bun scripts/op-run.ts bun run dev
 *
 * Requires: 1Password CLI (`op`) installed and signed in (`op signin`).
 */

import { spawnSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findPlaintextSecretOffenders,
  mergeChildEnv,
  parseDotenv,
  parseOpRunCommand,
} from './op-env-template';

const ROOT = resolve(import.meta.dirname, '..');
const DEFAULT_TEMPLATE = resolve(ROOT, 'secrets/op.env.tpl');

function usage(): void {
  console.error(`Usage: bun run op:run -- <command> [args...]

Loads secrets from a 1Password template (op:// references only) and runs <command>
with them in the environment. Secrets are never written to disk.

(Bun strips \`--\` before this script runs — pass the command after \`bun run op:run --\`.)

  AUTHPRINT_OP_ENV_FILE   Path to template (default: secrets/op.env.tpl)
  AUTHPRINT_OP_VERBOSE    Set to 1 to log injected variable names (not values)
  OP_ACCOUNT              Optional 1Password account shorthand for \`op\`

Setup: see secrets/README.md`);
}

function fail(message: string): never {
  console.error(`op-run: ${message}`);
  process.exit(1);
}

function assertOpAvailable(): void {
  const version = spawnSync('op', ['--version'], { encoding: 'utf8' });
  if (version.error || version.status !== 0) {
    fail(
      '1Password CLI (`op`) not found. Install: https://developer.1password.com/docs/cli/get-started/',
    );
  }
}

function assertTemplateSafe(templatePath: string): void {
  const offenders = findPlaintextSecretOffenders(readFileSync(templatePath, 'utf8'));
  if (offenders.length > 0) {
    fail(
      `template must use op:// references only, not plaintext values:\n  ${offenders.join('\n  ')}`,
    );
  }
}

function loadSecretsFromTemplate(templatePath: string): Record<string, string> {
  const result = spawnSync('op', ['inject', '-i', templatePath], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });

  if (result.status !== 0) {
    const detail = result.stderr?.trim() || result.stdout?.trim();
    fail(detail ? `op inject failed: ${detail}` : 'op inject failed');
  }

  return parseDotenv(result.stdout);
}

const command = parseOpRunCommand(process.argv.slice(2));
if (!command) {
  usage();
  process.exit(1);
}

const template = process.env.AUTHPRINT_OP_ENV_FILE
  ? resolve(process.cwd(), process.env.AUTHPRINT_OP_ENV_FILE)
  : DEFAULT_TEMPLATE;

if (!existsSync(template)) {
  fail(
    `template not found: ${template}\nCopy secrets/op.env.tpl.example → secrets/op.env.tpl and add your op:// references (see secrets/README.md).`,
  );
}

assertOpAvailable();
assertTemplateSafe(template);

const secretEnv = loadSecretsFromTemplate(template);
const childEnv = mergeChildEnv(process.env, secretEnv);

if (process.env.AUTHPRINT_OP_VERBOSE) {
  const names = Object.keys(secretEnv);
  console.error(
    names.length > 0
      ? `op-run: injecting ${names.join(', ')}`
      : 'op-run: no variables in template (all comments?)',
  );
}

const [executable, ...args] = command;
const result = spawnSync(executable, args, {
  stdio: 'inherit',
  cwd: ROOT,
  env: childEnv,
});

if (result.error) {
  fail(result.error.message);
}

process.exit(result.status ?? 1);
