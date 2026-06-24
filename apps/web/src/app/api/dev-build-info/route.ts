import { getGitBuildInfo } from '@/lib/git-build-info';

export function GET() {
  if (process.env.NODE_ENV !== 'development') {
    return new Response(null, { status: 404 });
  }

  const info = getGitBuildInfo();
  if (!info) {
    return Response.json({ error: 'Could not read git state' }, { status: 500 });
  }

  return Response.json(info);
}
