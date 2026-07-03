import { getBuildInfo } from '@/lib/build-info';

export function GET() {
  const info = getBuildInfo();
  if (!info) {
    return Response.json({ error: 'Could not read build info' }, { status: 500 });
  }

  return Response.json(info);
}
