#!/usr/bin/env bash
# Blocks a merge commit from landing directly on `main` unless the caller
# explicitly opts in. AGENTS.md already says implementers never merge to
# `main` — the Lead reviews and integrates — but that's a prose rule, and
# prose rules get missed under autopilot ("finish the task" -> merge the
# branch). This is the technical backstop for that specific rule.
#
# Legitimate Lead integrations set LEAD_INTEGRATION=1 for the one command,
# e.g.: LEAD_INTEGRATION=1 git merge --ff-only <branch>
set -euo pipefail

branch="$(git symbolic-ref --short HEAD 2>/dev/null || echo "")"

if [ "$branch" != "main" ]; then
  exit 0
fi

if [ "${LEAD_INTEGRATION:-}" = "1" ]; then
  exit 0
fi

cat >&2 <<'EOF'
BLOCKED: merge commit onto `main`.

Contributors never merge into `main` directly — hand your work back
committed on your own branch; the maintainer's integration flow
reviews and lands it.

If you actually are the Lead doing a deliberate integration, re-run
with the explicit opt-in:
  LEAD_INTEGRATION=1 git merge --ff-only <branch>
EOF
exit 1
