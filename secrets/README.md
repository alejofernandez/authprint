# Secrets — 1Password CLI, no `.env` on disk

Authprint never stores **plaintext** secrets in the repo or in local `.env` files. For local development (and later CI), secrets live in **1Password** and are injected into a child process at runtime via the [`op` CLI](https://developer.1password.com/docs/cli/).

Production hosting uses **GCP Secret Manager** — this folder is the **local dev** workflow.

## How it works

```
secrets/op.env.tpl          ← you maintain this locally (gitignored)
  KEY=op://Vault/Item/field   ← references only, resolved by 1Password

bun run op:run -- bun run dev
       │
       └── op inject -i … (resolve refs in memory)
             └── spawn child with { ...process.env, ...secrets }
```

- **Committed:** `op.env.tpl.example` (documentation + placeholder references)
- **Gitignored:** `op.env.tpl` (your personal vault/item paths)
- **Never committed:** plaintext secret values

The wrapper calls `op inject` to resolve `op://` references in memory, merges them into the child process `env`, then execs your command — no `.env` file is ever written.

## One-time setup

1. **Install 1Password CLI** — [Get started](https://developer.1password.com/docs/cli/get-started/)
2. **Sign in:** `op signin` (or enable desktop app integration)
3. **Create a 1Password item** (e.g. vault `Private`, item `Authprint Dev`) with fields for each secret you'll need.
4. **Copy the template:**
   ```bash
   cp secrets/op.env.tpl.example secrets/op.env.tpl
   ```
5. **Edit `secrets/op.env.tpl`** — uncomment lines and set `op://` paths. Find paths with:
   ```bash
   op item get "Authprint Dev" --format json
   # or copy from 1Password UI → right-click field → Copy Secret Reference
   ```

## Usage

```bash
# Run any command with secrets injected (nothing written to disk)
bun run op:run -- bun run dev
bun run op:run -- bun run build

# Custom template path
AUTHPRINT_OP_ENV_FILE=secrets/op.staging.tpl bun run op:run -- bun run dev
```

The wrapper (`scripts/op-run.ts`) checks that `op` is available and that the template contains **only** `op://` references (rejects accidental plaintext).

### Verify injection

```bash
AUTHPRINT_OP_VERBOSE=1 bun run op:run -- printenv AUTH_SECRET
```

Use `printenv` — not `echo $AUTH_SECRET`. Your **outer shell** expands `$AUTH_SECRET` before `op:run` runs, so the variable name never reaches the child. To test via echo, use a nested shell:

```bash
bun run op:run -- sh -c 'echo $AUTH_SECRET'
```

## Direct `op` usage (without the wrapper)

Equivalent core step (the wrapper adds validation + explicit env merge):

```bash
op inject -i secrets/op.env.tpl   # op masks secret values on stdout
```

**Do not** run `op inject -o .env` — that writes secrets to disk.

## CI (later)

Options when cloud CI needs secrets:

- `OP_SERVICE_ACCOUNT_TOKEN` + `op run` in the pipeline (same template pattern)
- 1Password [Environments](https://developer.1password.com/docs/environments/) with `op run --environment <id>`
- Production deploy: GCP Secret Manager (not 1Password)

## Adding a new secret

1. Add the field in 1Password.
2. Add `ENV_NAME=op://…` to `secrets/op.env.tpl`.
3. Read it in app code via `process.env.ENV_NAME` as usual — no `.env` file needed.

## Secret Scanning (Gitleaks)

To prevent plaintext secrets from accidentally entering git history, Gitleaks is integrated as a local pre-commit hook and runs in CI.

### Local Setup
1. **Install git hooks**:
   ```bash
   bun run prepare
   ```
This configures `lefthook` to run Gitleaks on staged changes during `git commit`.

2. **Self-Installing / Portable Wrapper**:
   There is no manual installation required! The pre-commit hook runs `scripts/gitleaks.sh`, which automatically downloads the pinned Gitleaks binary (`8.30.1`) for your host OS/architecture, validates its SHA-256 checksum, caches it in the gitignored `.tools/gitleaks/` directory, and executes it.
   *(Optional: You can still run `brew install gitleaks` if you want a global version for manual repository CLI queries, but the hooks will always use the pinned wrapper version).*

### How to Bypass / Handle False Positives
- **Do not use `LEFTHOOK=0`** to bypass checks, as it skips all pre-commit validation.
- If Gitleaks flags a false positive (e.g. a reference that looks like a key but is safe), add an exclusion pattern under `[[allowlists]]` in the [`.gitleaks.toml`](../.gitleaks.toml) configuration file.
- `op://` 1Password reference strings and `secrets/op.env.tpl*` files are already globally allowlisted.
