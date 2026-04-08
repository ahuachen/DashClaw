import { NextResponse } from 'next/server';
import { acknowledgeAlert, deleteAlert } from '../../../../lib/drift.js';

export async function PATCH(request, { params }) {
  try {
    const { alertId } = await params;
    const updated = await acknowledgeAlert(request, alertId);
    if (!updated) return NextResponse.json({ error: 'Alert not found' }, { status: 404 });
    return NextResponse.json(updated);
  } catch (err) {
    console.error('[drift/alerts/detail] PATCH error:', err);
    return NextResponse.json({ error: 'Failed to acknowledge alert' }, { status: 500 });
  }
}

export async function DELETE(request, { params }) {
  try {
    const { alertId } = await params;
    await deleteAlert(request, alertId);
    return NextResponse.json({ deleted: true });
  } catch (err) {
    console.error('[drift/alerts/detail] DELETE error:', err);
    return NextResponse.json({ error: 'Failed to delete alert' }, { status: 500 });
  }
}
