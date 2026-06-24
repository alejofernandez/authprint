import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import {
  findPlaintextSecretOffenders,
  mergeChildEnv,
  parseDotenv,
  parseOpRunCommand,
} from './op-env-template';

const EXAMPLE = resolve(import.meta.dirname, '../secrets/op.env.tpl.example');

describe('parseOpRunCommand', () => {
  test('uses all argv when Bun strips -- (bun run op:run -- echo hi)', () => {
    expect(parseOpRunCommand(['echo', 'hi'])).toEqual(['echo', 'hi']);
  });

  test('still supports explicit -- when invoked directly', () => {
    expect(parseOpRunCommand(['--', 'bun', 'run', 'dev'])).toEqual(['bun', 'run', 'dev']);
  });

  test('empty argv returns null', () => {
    expect(parseOpRunCommand([])).toBeNull();
  });
});

describe('parseDotenv', () => {
  test('parses key=value lines and skips comments', () => {
    expect(
      parseDotenv(`
# comment
AUTH_SECRET=resolved-value
QUOTED="has spaces"
`),
    ).toEqual({
      AUTH_SECRET: 'resolved-value',
      QUOTED: 'has spaces',
    });
  });
});

describe('mergeChildEnv', () => {
  test('injected secrets override parent and fill child env', () => {
    const child = mergeChildEnv(
      { PATH: '/usr/bin', AUTH_SECRET: undefined, HOME: '/tmp' },
      { AUTH_SECRET: 'from-1password' },
    );
    expect(child).toEqual({
      PATH: '/usr/bin',
      HOME: '/tmp',
      AUTH_SECRET: 'from-1password',
    });
  });
});

describe('findPlaintextSecretOffenders', () => {
  test('allows op:// references and comments', () => {
    const text = `
# comment
AUTH_SECRET=op://Private/Authprint Dev/auth-secret
AUTH_QUOTED="op://Private/Authprint Dev/auth-secret"
EMPTY=
`;
    expect(findPlaintextSecretOffenders(text)).toEqual([]);
  });

  test('rejects plaintext values', () => {
    const text = 'API_KEY=sk-live-not-a-reference';
    expect(findPlaintextSecretOffenders(text)).toEqual(['line 1: API_KEY=…']);
  });

  test('committed example template has no plaintext secrets', () => {
    expect(findPlaintextSecretOffenders(readFileSync(EXAMPLE, 'utf8'))).toEqual([]);
  });
});
