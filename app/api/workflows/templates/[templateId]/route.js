export const dynamic = 'force-dynamic';
export const revalidate = 0;

import { NextResponse } from 'next/server';
import { getSql } from '../../../../lib/db.js';
import { getOrgId } from '../../../../lib/org.js';
import { apiErrorResponse } from '../../../../lib/apiErrors.js';
import {
  getWorkflowTemplate,
  updateWorkflowTemplate,
} from '../../../../lib/repositories/workflow-templates.repository.js';

export async function GET(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { templateId } = await params;

    const template = await getWorkflowTemplate(sql, orgId, templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template });
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW TEMPLATE GET');
  }
}

export async function PATCH(request, { params }) {
  try {
    const sql = getSql();
    const orgId = getOrgId(request);
    const { templateId } = await params;
    const body = await request.json();

    const updated = await updateWorkflowTemplate(sql, orgId, templateId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json({ template: updated });
  } catch (error) {
    return apiErrorResponse(error, 'WORKFLOW TEMPLATE PATCH');
  }
}
