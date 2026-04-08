import { NextResponse } from 'next/server';
import { getTemplate, updateTemplate, deleteTemplate } from '../../../../lib/prompt.js';

export async function GET(request, { params }) {
  try {
    const { templateId } = await params;
    const template = await getTemplate(request, templateId);
    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }
    return NextResponse.json(template);
  } catch (err) {
    console.error('[prompts/templates/detail] GET error:', err);
    return NextResponse.json({ error: 'Failed to fetch template' }, { status: 500 });
  }
}

export async function PATCH(request, { params }) {
  try {
    const { templateId } = await params;
    const body = await request.json();
    const updated = await updateTemplate(request, templateId, body);
    if (!updated) {
      return NextResponse.json({ error: 'Template not found or no changes' }, { status: 404 });
    }
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[prompts/templates/detail] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to update template' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { templateId } = await params;
    await deleteTemplate(request, templateId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[prompts/templates/detail] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
