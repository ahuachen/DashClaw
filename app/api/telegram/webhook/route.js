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

async function answerCallback(callback_query_id, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/answerCallbackQuery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ callback_query_id, ...(text ? { text } : {}) }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[TelegramWebhook] answerCallback failed:', err.message);
  }
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

  const match = (cq.data ?? '').match(CALLBACK_DATA_RE);
  if (!match) {
    await answerCallback(cq.id, 'Unknown button');
    return ok();
  }
  const [, verb, action_id] = match;

  // Task 7 through Task 9 add approve/deny/idempotency using verb + action_id.
  return ok();
}
