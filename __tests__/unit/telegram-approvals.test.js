import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

const { fireTelegramApproval } = await import('../../app/lib/telegramApprovals.js');

describe('fireTelegramApproval — config gate', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'test-token';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '12345';
    delete process.env.DASHCLAW_ALERTS_TELEGRAM;
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  const pendingAction = {
    action_id: 'act_abc123def',
    status: 'pending_approval',
    agent_id: 'openclaw-telegram',
    action_type: 'deploy',
    risk_score: 80,
    reversible: false,
    declared_goal: 'Push release/v0.4.2 to production',
  };

  it('returns silently when TELEGRAM_BOT_TOKEN is missing', async () => {
    delete process.env.TELEGRAM_BOT_TOKEN;
    fireTelegramApproval(pendingAction, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns silently when DASHCLAW_ALERTS_TELEGRAM === 'false'", async () => {
    process.env.DASHCLAW_ALERTS_TELEGRAM = 'false';
    fireTelegramApproval(pendingAction, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns silently when action status is not pending_approval', async () => {
    fireTelegramApproval({ ...pendingAction, status: 'running' }, null, 'org_1');
    await new Promise((r) => setImmediate(r));
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('fireTelegramApproval — payload', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.TELEGRAM_BOT_TOKEN = 'TBOT';
    process.env.TELEGRAM_ADMIN_CHAT_ID = '42';
    delete process.env.DASHCLAW_ALERTS_TELEGRAM;
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...originalEnv };
    vi.restoreAllMocks();
  });

  it('POSTs to /sendMessage with chat_id, text, and inline keyboard', async () => {
    const action = {
      action_id: 'act_abc12345',
      status: 'pending_approval',
      agent_id: 'openclaw-telegram',
      action_type: 'deploy',
      risk_score: 80,
      reversible: false,
      declared_goal: 'Push release/v0.4.2 to production',
    };

    fireTelegramApproval(action, null, 'org_1');
    await new Promise((r) => setImmediate(r));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const [url, init] = mockFetch.mock.calls[0];
    expect(url).toBe('https://api.telegram.org/botTBOT/sendMessage');
    expect(init.method).toBe('POST');
    expect(init.headers['Content-Type']).toBe('application/json');

    const body = JSON.parse(init.body);
    expect(body.chat_id).toBe('42');
    expect(body.text).toContain('openclaw-telegram');
    expect(body.text).toContain('deploy');
    expect(body.text).toContain('80');
    expect(body.text).toContain('irreversible');
    expect(body.text).toContain('Push release/v0.4.2 to production');
    expect(body.text).toContain('act_abc12345');

    expect(body.reply_markup.inline_keyboard).toEqual([[
      { text: '✅ Approve', callback_data: 'ap:act_abc12345' },
      { text: '❌ Reject',  callback_data: 'dn:act_abc12345' },
    ]]);
  });

  it('renders reversible actions with the reversible label', async () => {
    fireTelegramApproval({
      action_id: 'act_rev0001x',
      status: 'pending_approval',
      agent_id: 'a', action_type: 'review',
      risk_score: 10, reversible: true, declared_goal: 'read files',
    }, null, 'org_1');
    await new Promise((r) => setImmediate(r));

    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    expect(body.text).toContain('reversible');
    expect(body.text).not.toContain('irreversible');
  });
});
