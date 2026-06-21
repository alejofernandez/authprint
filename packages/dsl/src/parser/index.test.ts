import { describe, expect, test } from 'bun:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { parse } from './index.ts';

const here = fileURLToPath(new URL('.', import.meta.url));

describe('parse — happy path', () => {
  test('minimal flow parses with schema defaults applied', () => {
    const input = `
id: f1
name: Minimal flow
`;
    const r = parse(input);
    expect(r.diagnostics.filter((d) => d.severity === 'error')).toEqual([]);
    expect(r.flow).not.toBeNull();
    expect(r.flow?.theme).toBe('light');
    expect(r.flow?.nodes).toEqual([]);
  });

  test('passkey-enrollment example parses cleanly', () => {
    const input = readFileSync(
      `${here}/../../../dsl-spec/examples/passkey-enrollment.authprint`,
      'utf8',
    );
    const r = parse(input);
    const errors = r.diagnostics.filter((d) => d.severity === 'error');
    expect(errors).toEqual([]);
    expect(r.flow).not.toBeNull();
    expect(r.flow?.nodes.length).toBeGreaterThan(0);
    expect(r.flow?.scenarios.length).toBeGreaterThan(0);
  });
});

describe('parse — error paths', () => {
  test('invalid YAML produces yaml-parse-error', () => {
    const r = parse('id: f1\nname: F1\n  bad: indent');
    expect(r.flow).toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'yaml-parse-error')).toBe(true);
  });

  test('anchor is rejected', () => {
    const r = parse(`
id: f1
name: &n Anchor flow
`);
    expect(r.flow).toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'yaml-anchor-rejected')).toBe(true);
  });

  test('alias is rejected', () => {
    // Define an anchor and use an alias — both should be rejected, but the
    // alias is the key behavior to test.
    const r = parse(`
id: f1
name: &n Anchor flow
description: *n
`);
    expect(r.flow).toBeNull();
    // Either rejection code is acceptable as long as the parse fails cleanly.
    expect(
      r.diagnostics.some(
        (d) => d.code === 'yaml-anchor-rejected' || d.code === 'yaml-alias-rejected',
      ),
    ).toBe(true);
  });

  test('schema violation surfaces with path', () => {
    const r = parse(`
id: f1
name: F1
nodes:
  - type: screen
    id: s1
    name: X
    kind: password
    traits: ["this-trait-is-not-real"]
    fields: []
    fidelity: lo-fi
`);
    expect(r.flow).toBeNull();
    const schemaError = r.diagnostics.find((d) => d.code === 'schema-violation');
    expect(schemaError).not.toBeUndefined();
    expect(schemaError?.path).toBeDefined();
  });
});

describe('parse — vocabulary warnings', () => {
  test('unknown screen kind emits warning, flow still returned', () => {
    const r = parse(`
id: f1
name: F1
nodes:
  - type: screen
    id: s1
    name: X
    kind: completely-custom-kind
    traits: []
    fields: []
    fidelity: lo-fi
`);
    expect(r.flow).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'vocabulary-unknown-screen-kind')).toBe(true);
  });

  test('unknown field type emits warning', () => {
    const r = parse(`
id: f1
name: F1
nodes:
  - type: screen
    id: s1
    name: X
    kind: password
    traits: []
    fields:
      - name: weird
        type: not-a-real-field-type
        required: true
    fidelity: lo-fi
`);
    expect(r.flow).not.toBeNull();
    expect(r.diagnostics.some((d) => d.code === 'vocabulary-unknown-field-type')).toBe(true);
  });

  test('known kinds emit no vocabulary warnings', () => {
    const r = parse(`
id: f1
name: F1
nodes:
  - type: screen
    id: s1
    name: Sign in
    kind: password
    traits: []
    fields:
      - name: identifier
        type: identifier
        required: true
    fidelity: lo-fi
  - type: external
    id: x1
    name: Google
    kind: google
  - type: outcome
    id: o1
    name: Authenticated
    kind: authenticated
`);
    expect(r.flow).not.toBeNull();
    expect(r.diagnostics.filter((d) => d.code.startsWith('vocabulary-'))).toEqual([]);
  });
});
