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

describe('POST /api/telegram/webhook — callback_data validation', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };

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

  it('returns 200 and answers with toast when callback_data is malformed', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 42 }, data: 'WAT:act_abc' } },
      AUTH,
    ));
    expect(res.status).toBe(200);
    expect(mockGetActionStatus).not.toHaveBeenCalled();

    const ackCall = mockFetch.mock.calls.find(([u]) =>
      u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
    expect(JSON.parse(ackCall[1].body).text).toContain('Unknown');
  });

  it('returns 200 when callback_data is missing entirely', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 42 } } },
      AUTH,
    ));
    expect(res.status).toBe(200);
    expect(mockGetActionStatus).not.toHaveBeenCalled();

    const ackCall = mockFetch.mock.calls.find(([u]) =>
      u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
    expect(JSON.parse(ackCall[1].body).text).toContain('Unknown');
  });

  it('accepts realistic action_id shapes (UUID with hyphens, underscores)', async () => {
    // Regression for the regex that previously rejected every real action_id.
    const realisticIds = [
      'act_550e8400-e29b-41d4-a716-446655440000', // act_${crypto.randomUUID()}
      'act_gd_0123456789abcdef',                   // guard decision id
      'act_sim_abcd1234',                          // demo sim id
    ];
    for (const id of realisticIds) {
      mockFetch.mockClear();
      const res = await POST(req(
        { callback_query: { id: 'cq1', from: { id: 42 }, data: `ap:${id}` } },
        AUTH,
      ));
      expect(res.status).toBe(200);
      // Regex matches, so the "Unknown button" toast path MUST NOT fire.
      const unknownAck = mockFetch.mock.calls.find(([u, init]) =>
        u.includes('/answerCallbackQuery') &&
        JSON.parse(init.body).text?.includes('Unknown'));
      expect(unknownAck).toBeUndefined();
    }
  });
});
