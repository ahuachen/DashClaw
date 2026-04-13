import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import {
  getActionStatus,
  recordApproval,
} from '../../../lib/repositories/actions.repository.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FETCH_TIMEOUT_MS = 1500;
const CALLBACK_DATA_RE = /^(ap|dn):(act_[a-z0-9]{8,32})$/;

function unauthorized() {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
}
function forbidden() {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
}
function ok() {
  return NextResponse.json({ ok: true });
}

export async function POST(request) {
  const presented = request.headers.get('x-telegram-bot-api-secret-token');
  const expected = process.env.TELEGRAM_WEBHOOK_SECRET;
  if (!presented || !expected || presented !== expected) return unauthorized();

  let body;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const cq = body?.callback_query;
  if (!cq) return ok(); // non-callback update, ignore

  const senderId = String(cq.from?.id ?? '');
  if (senderId !== process.env.TELEGRAM_ADMIN_CHAT_ID) return forbidden();

  // Task 6 adds callback_data parsing + answerCallbackQuery.
  // Task 7 through Task 9 add approve/deny/idempotency.
  return ok();
}
