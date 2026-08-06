import { describe, expect, test } from 'bun:test';
import { CSP_REQUIRED_DIRECTIVES, contentSecurityPolicy } from './contentSecurityPolicy.ts';

describe('contentSecurityPolicy', () => {
  test('production policy contains every required directive and no unsafe-eval', () => {
    const value = contentSecurityPolicy({ isDev: false });
    for (const directive of CSP_REQUIRED_DIRECTIVES) {
      expect(value).toContain(directive);
    }
    expect(value).toContain("script-src 'self' 'unsafe-inline'");
    expect(value).not.toContain('unsafe-eval');
  });

  test('development policy adds unsafe-eval for React error stacks', () => {
    const value = contentSecurityPolicy({ isDev: true });
    for (const directive of CSP_REQUIRED_DIRECTIVES) {
      expect(value).toContain(directive);
    }
    expect(value).toContain("script-src 'self' 'unsafe-inline' 'unsafe-eval'");
  });

  test('img-src and connect-src stay explicit (exfil fence)', () => {
    const value = contentSecurityPolicy({ isDev: false });
    // A future "simplify to default-src only" would drop these tokens.
    expect(value).toMatch(/img-src 'self' data: blob:/);
    expect(value).toMatch(/connect-src 'self'/);
  });
});
