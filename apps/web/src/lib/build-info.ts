// Unified build metadata — dev shells out to git; prod reads values baked at image build.

import fs from 'node:fs';
import path from 'node:path';
import { getGitBuildInfo } from '@/lib/git-build-info';

export type BuildInfo = {
  sha: string;
  ref: string;
  builtAt: string | null;
  version: string | null;
};

export type DevBuildInfo = BuildInfo & {
  worktree: string;
  dirty: boolean;
  repoRoot: string;
};

export type BuildInfoResponse = BuildInfo | DevBuildInfo;

const BAKED_BUILD_INFO_PATH = path.join(process.cwd(), 'build-info.json');

function getBakedBuildInfo(): BuildInfo | null {
  try {
    const raw = fs.readFileSync(BAKED_BUILD_INFO_PATH, 'utf8');
    const parsed = JSON.parse(raw) as BuildInfo;
    if (
      typeof parsed.sha !== 'string' ||
      typeof parsed.ref !== 'string' ||
      !('builtAt' in parsed) ||
      !('version' in parsed)
    ) {
      return null;
    }
    return parsed;
  } catch {
    return null;
  }
}

export function getBuildInfo(): BuildInfoResponse | null {
  if (process.env.NODE_ENV === 'development') {
    const git = getGitBuildInfo();
    if (!git) return null;

    return {
      sha: git.commit,
      ref: git.branch,
      builtAt: null,
      version: null,
      worktree: git.worktree,
      dirty: git.dirty,
      repoRoot: git.repoRoot,
    };
  }

  return getBakedBuildInfo();
}
