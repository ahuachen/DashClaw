import { NextResponse } from 'next/server';
import { getSql } from '../../../lib/db.js';
import {
  getActionSummary,
  recordApproval,
} from '../../../lib/repositories/actions.repository.js';

const TELEGRAM_API_BASE = 'https://api.telegram.org';
const FETCH_TIMEOUT_MS = 1500;
const CALLBACK_DATA_RE = /^(ap|dn):(act_[a-z0-9_-]{1,57})$/;

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

async function editMessage(chat_id, message_id, text) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  try {
    await fetch(`${TELEGRAM_API_BASE}/bot${token}/editMessageText`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        chat_id, message_id, text,
        reply_markup: { inline_keyboard: [] },
      }),
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
  } catch (err) {
    console.warn('[TelegramWebhook] editMessage failed:', err.message);
  }
}

function buildResolvedText(action, decisionLabel, action_id) {
  const ts = new Date().toTimeString().slice(0, 8);
  const goal = (action.declared_goal || '—').slice(0, 200);
  return [
    `${decisionLabel} — ${ts}`,
    '',
    `Agent:   ${action.agent_id || 'unknown'}`,
    `Action:  ${action.action_type || 'unknown'}`,
    `Goal: ${goal}`,
    '',
    action_id,
  ].join('\n');
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

  const sql = getSql();
  const orgId = process.env.TELEGRAM_APPROVER_ORG_ID;
  const action = await getActionSummary(sql, orgId, action_id);

  const chat_id = cq.message?.chat?.id;
  const message_id = cq.message?.message_id;

  if (!action) {
    await Promise.all([
      answerCallback(cq.id, 'Action not found'),
      editMessage(chat_id, message_id, '⚠️ Action not found'),
    ]);
    return ok();
  }

  if (action.status !== 'pending_approval') {
    await Promise.all([
      answerCallback(cq.id, 'Already resolved'),
      editMessage(chat_id, message_id,
        `⚠️ Already resolved — status: ${action.status}`),
    ]);
    return ok();
  }

  const userId = `telegram:${senderId}`;

  if (verb === 'ap') {
    try {
      await recordApproval(sql, orgId, action_id, {
        newStatus: 'running',
        errorMessage: null,
        decision: 'allow',
        userId,
        safeReasoning: null,
      });
    } catch (err) {
      console.warn('[TelegramWebhook] recordApproval (approve) failed:', err.message);
      await answerCallback(cq.id, 'Approval failed');
      return ok();
    }
    await Promise.all([
      answerCallback(cq.id),
      editMessage(chat_id, message_id,
        buildResolvedText(action, '✅ Approved by Telegram admin', action_id)),
    ]);
    return ok();
  }

  // verb === 'dn'
  try {
    await recordApproval(sql, orgId, action_id, {
      newStatus: 'failed',
      errorMessage: 'Denied via Telegram',
      decision: 'deny',
      userId,
      safeReasoning: 'Denied via Telegram',
    });
  } catch (err) {
    console.warn('[TelegramWebhook] recordApproval (deny) failed:', err.message);
    await answerCallback(cq.id, 'Approval failed');
    return ok();
  }
  await Promise.all([
    answerCallback(cq.id),
    editMessage(chat_id, message_id,
      buildResolvedText(action, '❌ Denied by Telegram admin', action_id)),
  ]);
  return ok();
}
