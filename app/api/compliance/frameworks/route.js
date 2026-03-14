export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { listFrameworks, loadFramework } from '../../../lib/compliance/mapper.js';

/**
 * GET /api/compliance/frameworks — List available compliance frameworks
 */
export async function GET() {
  try {
    const frameworkIds = listFrameworks();
    const frameworks = frameworkIds.map(id => {
      const fw = loadFramework(id);
      return {
        id,
        name: fw.framework,
        version: fw.version,
        description: fw.description,
        control_count: fw.controls.length,
      };
    });

    return NextResponse.json({ frameworks });
  } catch (err) {
    console.error('[COMPLIANCE/FRAMEWORKS] GET error:', err);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
