import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockFetch, mockGetActionSummary, mockRecordApproval } = vi.hoisted(() => ({
  mockFetch: vi.fn(),
  mockGetActionSummary: vi.fn(),
  mockRecordApproval: vi.fn(),
}));

vi.stubGlobal('fetch', mockFetch);
vi.mock('../../app/lib/db.js', () => ({ getSql: () => ({}) }));
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  getActionSummary: (...a) => mockGetActionSummary(...a),
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
    expect(mockGetActionSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret does not match', async () => {
    const res = await POST(req(
      { callback_query: { id: 'cq1' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'WRONG' },
    ));
    expect(res.status).toBe(401);
    expect(mockGetActionSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when the secret length differs from expected', async () => {
    // Regression for timingSafeEqual — different-length buffers must not throw.
    const res = await POST(req(
      { callback_query: { id: 'cq1' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'SHORT' },
    ));
    expect(res.status).toBe(401);
  });

  it('returns 401 when callback sender is not the admin chat', async () => {
    // Collapsed 403 → 401 so the endpoint does not leak "secret correct but
    // chat_id wrong" as a distinguishable response.
    const res = await POST(req(
      { callback_query: { id: 'cq1', from: { id: 9999 }, data: 'ap:act_abc12345' } },
      { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' },
    ));
    expect(res.status).toBe(401);
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
    expect(mockGetActionSummary).not.toHaveBeenCalled();

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
    expect(mockGetActionSummary).not.toHaveBeenCalled();

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
      mockGetActionSummary.mockResolvedValueOnce(null);
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

describe('POST /api/telegram/webhook — approve', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };
  const pending = {
    action_id: 'act_abc12345',
    status: 'pending_approval',
    agent_id: 'openclaw-tg',
    action_type: 'deploy',
    declared_goal: 'Push release v0.4.2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionSummary.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'running' });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('calls recordApproval with allow + synthesized user id, edits message, acks callback', async () => {
    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockGetActionSummary).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
    );
    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
      expect.objectContaining({
        decision: 'allow',
        newStatus: 'running',
        errorMessage: null,
        userId: 'telegram:42',
      }),
    );

    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    const editBody = JSON.parse(editCall[1].body);
    // chat_id is always pulled from TELEGRAM_ADMIN_CHAT_ID (env), not the body
    expect(editBody.chat_id).toBe('42');
    expect(editBody.message_id).toBe(1001);
    expect(editBody.text).toContain('✅ Approved');
    expect(editBody.reply_markup).toEqual({ inline_keyboard: [] });

    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
  });

  it('acks the callback BEFORE the recordApproval DB call (prevents Telegram retries)', async () => {
    // Capture fetch call order relative to recordApproval call order.
    const ackIndexes = [];
    mockFetch.mockImplementation((url) => {
      if (url.includes('/answerCallbackQuery')) {
        ackIndexes.push(mockRecordApproval.mock.calls.length);
      }
      return Promise.resolve({ ok: true, status: 200 });
    });

    await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    // First ack must happen before recordApproval has been called.
    expect(ackIndexes[0]).toBe(0);
  });
});

describe('POST /api/telegram/webhook — deny', () => {
  const AUTH = { 'X-Telegram-Bot-Api-Secret-Token': 'S3CRET' };
  const pending = {
    action_id: 'act_abc12345',
    status: 'pending_approval',
    agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_WEBHOOK_SECRET = 'S3CRET';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    process.env.TELEGRAM_APPROVER_ORG_ID = 'org_tele';
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionSummary.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'failed' });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('calls recordApproval with deny + "Denied via Telegram" reason', async () => {
    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'dn:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_tele', 'act_abc12345',
      expect.objectContaining({
        decision: 'deny',
        newStatus: 'failed',
        errorMessage: 'Denied via Telegram',
        userId: 'telegram:42',
      }),
    );
    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    const editBody = JSON.parse(editCall[1].body);
    expect(editBody.chat_id).toBe('42'); // always from env
    expect(editBody.text).toContain('❌ Denied');
  });
});

describe('POST /api/telegram/webhook — idempotency and errors', () => {
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

  it('does not call recordApproval when action is already resolved, and edits with "Already resolved"', async () => {
    mockGetActionSummary.mockResolvedValue({
      action_id: 'act_abc12345', status: 'completed',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).not.toHaveBeenCalled();

    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(JSON.parse(editCall[1].body).text).toContain('Already resolved');

    // Ack still fires (before DB work); text lives in editMessage now.
    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();
  });

  it('returns "Already resolved — resolved by another channel" when recordApproval returns null (race)', async () => {
    // Simulates atomic status guard in recordApproval detecting that another
    // caller already resolved the action between the getActionSummary read
    // and the UPDATE.
    mockGetActionSummary.mockResolvedValue({
      action_id: 'act_abc12345', status: 'pending_approval',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });
    mockRecordApproval.mockResolvedValue(null);

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);

    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    expect(JSON.parse(editCall[1].body).text).toContain('Already resolved');
  });

  it('short-circuits with "Action not found" when getActionSummary returns null', async () => {
    mockGetActionSummary.mockResolvedValue(null);

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockRecordApproval).not.toHaveBeenCalled();
    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    expect(JSON.parse(editCall[1].body).text).toContain('Action not found');
  });

  it('surfaces misconfig when TELEGRAM_APPROVER_ORG_ID is missing', async () => {
    delete process.env.TELEGRAM_APPROVER_ORG_ID;

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    expect(mockGetActionSummary).not.toHaveBeenCalled();
    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    expect(JSON.parse(editCall[1].body).text).toContain('misconfigured');
  });

  it('still acks the callback when recordApproval throws', async () => {
    mockGetActionSummary.mockResolvedValue({
      action_id: 'act_abc12345', status: 'pending_approval',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });
    mockRecordApproval.mockRejectedValue(new Error('DB down'));

    const res = await POST(req(
      {
        callback_query: {
          id: 'cq1',
          from: { id: 42 },
          message: { chat: { id: 42 }, message_id: 1001 },
          data: 'ap:act_abc12345',
        },
      },
      AUTH,
    ));

    expect(res.status).toBe(200);
    const ackCall = mockFetch.mock.calls.find(([u]) => u.includes('/answerCallbackQuery'));
    expect(ackCall).toBeDefined();

    // Failure feedback now lives in editMessage (single-ack constraint).
    const editCall = mockFetch.mock.calls.find(([u]) => u.includes('/editMessageText'));
    expect(editCall).toBeDefined();
    expect(JSON.parse(editCall[1].body).text).toContain('Approval failed');
  });
});
