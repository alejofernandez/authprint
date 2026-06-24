// Dev-only: read current git branch, commit, and worktree from the repo root.

import { execSync } from 'node:child_process';
import path from 'node:path';

export type GitBuildInfo = {
  branch: string;
  commit: string;
  /** Worktree folder name, or the repo folder when on the primary checkout. */
  worktree: string;
  dirty: boolean;
  repoRoot: string;
};

function runGit(args: string, cwd: string): string {
  return execSync(`git ${args}`, { cwd, encoding: 'utf8' }).trim();
}

export function getGitBuildInfo(): GitBuildInfo | null {
  if (process.env.NODE_ENV !== 'development') return null;

  try {
    const repoRoot = runGit('rev-parse --show-toplevel', process.cwd());
    const branch = runGit('branch --show-current', repoRoot) || '(detached)';
    const commit = runGit('rev-parse --short HEAD', repoRoot);
    const gitDir = runGit('rev-parse --git-dir', repoRoot);
    const worktree = gitDir.includes(`${path.sep}worktrees${path.sep}`)
      ? path.basename(gitDir)
      : path.basename(repoRoot);
    const dirty = runGit('status --porcelain', repoRoot).length > 0;

    return { branch, commit, worktree, dirty, repoRoot };
  } catch {
    return null;
  }
}
