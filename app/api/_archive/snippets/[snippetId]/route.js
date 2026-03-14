export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import { getOrgId } from '../../../lib/org.js';
import { getSnippetById } from '../../../lib/repositories/snippets.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { snippetId } = await params;

    const snippet = await getSnippetById(sql, orgId, snippetId);

    if (!snippet) {
      return NextResponse.json({ error: 'Snippet not found' }, { status: 404 });
    }

    return NextResponse.json({ snippet });
  } catch (error) {
    console.error('Snippet GET error:', error);
    return NextResponse.json({ error: 'An error occurred while fetching snippet' }, { status: 500 });
  }
}
