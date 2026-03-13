export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { getReadinessReport, projectReadinessReport } from '../../../lib/readiness.mjs';
import { getViewerContextFromCookieHeader } from '../../../lib/sessionViewer.mjs';

function buildResponse(artifact, download) {
  const body = JSON.stringify(artifact, null, 2);
  const headers = {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
  };

  if (download) {
    headers['Content-Disposition'] = `attachment; filename="dashclaw-setup-proof-${Date.now()}.json"`;
  }

  return new Response(body, {
    status: 200,
    headers,
  });
}

export async function GET(request) {
  try {
    const url = new URL(request.url);
    const download = url.searchParams.get('download') === '1';
    const cookieHeader = request.headers.get('cookie') || '';
    const viewer = await getViewerContextFromCookieHeader(cookieHeader, process.env);
    const report = await getReadinessReport(process.env, { host: url.host });
    const view = projectReadinessReport(report, {
      isAuthenticated: viewer.isAuthenticated,
      host: url.host,
    });

    return buildResponse(view.proofArtifact, download);
  } catch (err) {
    console.error('[SETUP/PROOF] GET error:', err);
    return Response.json({ error: 'Internal server error' }, { status: 500 });
  }
}

