# @authprint/dsl-spec

The Authprint DSL **specification document**. Prose, grammar reference, vocabulary, examples, semantics.

This is the canonical authority for the DSL — the reference TypeScript implementation in [`@authprint/dsl`](../dsl/) is one consumer of it; third-party tools (validators, codegen, alternate parsers) are others.

## Contents

| File | Purpose |
|---|---|
| [`vocabulary.md`](./vocabulary.md) | Canonical word list for kinds / traits / fields / triggers / actions / predicate operators / context slot types. Includes a "Rejected names" table documenting why certain spec-correct names were not adopted (per Principle 7). |
| [`grammar.md`](./grammar.md) | The strict YAML subset and document shape. Full reference at the bottom. |
| [`semantics.md`](./semantics.md) | What each construct *means*. The authoritative reference for tool authors who want to consume Authprint flows. |
| [`decisions/`](./decisions/) | Architecture Decision Records. Currently: [0001 — DSL on-disk format](./decisions/0001-dsl-format.md). |
| [`examples/`](./examples/) | Annotated example flows: [passkey-enrollment](./examples/passkey-enrollment.authprint), [magic-link-signin](./examples/magic-link-signin.authprint). |

## On editor support

Files use the `.authprint` extension. Tooling associations:

- **VS Code / Cursor / Windsurf** — `.vscode/settings.json` at repo root maps `*.authprint` and `*.authprint.layout` to YAML syntax mode. Install the [YAML extension by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.vscode-yaml) for completion and validation.
- **Vim / Neovim** — add to your config:
  ```vim
  autocmd BufRead,BufNewFile *.authprint set filetype=yaml
  autocmd BufRead,BufNewFile *.authprint.layout set filetype=yaml
  ```
- **Emacs** — add to init:
  ```elisp
  (add-to-list 'auto-mode-alist '("\\.authprint\\'" . yaml-mode))
  (add-to-list 'auto-mode-alist '("\\.authprint\\.layout\\'" . yaml-mode))
  ```
- **JetBrains** — Settings → Editor → File Types → YAML → add `*.authprint` and `*.authprint.layout` patterns.

## On MIME types

For HTTP responses serving a flow as a download:

- `.authprint` → `application/vnd.authprint+yaml`
- `.authprint.layout` → `application/vnd.authprint.layout+yaml`

Vendor tree per RFC 6838, `+yaml` structured-syntax suffix per RFC 6839. The `vnd.authprint` prefix is reserved-by-convention for our use; formal IANA registration is a small future task.

## License

**CC-BY 4.0.** Reusable and extendable with attribution to Authprint as origin. See [`LICENSE`](./LICENSE).

This license is intentionally different from the reference implementation (MIT). The spec text is a document, not code; CC-BY 4.0 is the conventional license for spec documents (CommonMark, GraphQL, etc.).
