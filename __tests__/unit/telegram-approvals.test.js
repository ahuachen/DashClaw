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
