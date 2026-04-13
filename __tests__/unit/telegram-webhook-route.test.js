import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockFetch, mockGetActionStatus, mockRecordApproval } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetActionStatus: vi.fn(),
  mockRecordApproval: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);
vi.mock('../../app/lib/db.js', () => ({ getSql: () => ({}) }));
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  getActionStatus: (...a) => mockGetActionStatus(...a),
  recordApproval: (...a) => mockRecordApproval(...a),
}));

const { POST } = await import('../../app/api/telegram/webhook/route.js');

function req(body, headers = {}) {
  return makeRequest('http://localhost:3000/api/telegram/webhook', {
    headers: { 'Content-Type': 'application/json', ...headers },
    body,
  });
}

const ORIGINAL_ENV = { ...process.env };

describe('POST /api/telegram/webhook — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns 401 when X-Telegram-Bot-Api-Secret-Token is missing', async () => {
    const res = await POST(req({ callback_query: { id: 'cq1' } }));
    expect(res.status).toBe(401);
    expect(mockGetActionStatus).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret does not match', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'WRONG' },
    ));
    expect(res.status).toBe(401);
    expect(mockGetActionStatus).not.toHaveBeenCalled();
  });

  it('returns 403 when callback sender is not the admin chat', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 9999 }, data: 'ap:act_abc12345' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' },
    ));
    expect(res.status).toBe(403);
    expect(mockRecordApproval).not.toHaveBeenCalled();
  });
});
