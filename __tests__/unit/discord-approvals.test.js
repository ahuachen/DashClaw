import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { mockFetch } = vi.hoisted(() => ({ mockFetch: vi.fn() }));
vi.stubGlobal('fetch', mockFetch);

// Re-import the module for each test so the in-memory DM channel cache
// (per-process) is reset between tests.
async function loadModule() {
  vi.resetModules();
  return import('../../app/lib/discordApprovals.js');
}

const pendingAction = {
  action_id: 'act_abc12345',
  status: 'pending_approval',
  agent_id: 'claude-code',
  action_type: 'deploy',
  risk_score: 80,
  reversible: false,
  declared_goal: 'Deploy release/v0.4.2',
};

const ORIGINAL_ENV = { ...process.env };

describe('fireDiscordApproval — isEnabled gate', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.DISCORD_BOT_TOKEN = 'DBOT';
    process.env.DISCORD_APPROVER_USER_ID = '111222333';
    delete process.env.DASHCLAW_ALERTS_DISCORD;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns silently when DISCORD_BOT_TOKEN is unset (no fetch)', async () => {
    delete process.env.DISCORD_BOT_TOKEN;
    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval(pendingAction, null, 'org_1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns silently when DISCORD_APPROVER_USER_ID is unset (no fetch)', async () => {
    delete process.env.DISCORD_APPROVER_USER_ID;
    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval(pendingAction, null, 'org_1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("returns silently when DASHCLAW_ALERTS_DISCORD === 'false'", async () => {
    process.env.DASHCLAW_ALERTS_DISCORD = 'false';
    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval(pendingAction, null, 'org_1');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('returns silently when action.status is not pending_approval (no fetch)', async () => {
    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval({ ...pendingAction, status: 'running' }, null, 'org_1');
    expect(mockFetch).not.toHaveBeenCalled();
  });
});

describe('fireDiscordApproval — fetch shape', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.DISCORD_BOT_TOKEN = 'DBOT';
    process.env.DISCORD_APPROVER_USER_ID = '111222333';
    delete process.env.DASHCLAW_ALERTS_DISCORD;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('opens a DM channel then posts an approval message (2 fetch calls total)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'dm_channel_1' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval(pendingAction, null, 'org_1');

    expect(mockFetch).toHaveBeenCalledTimes(2);

    const [openUrl, openInit] = mockFetch.mock.calls[0];
    expect(openUrl).toBe('https://discord.com/api/v10/users/@me/channels');
    expect(openInit.method).toBe('POST');
    expect(openInit.headers.Authorization).toBe('Bot DBOT');
    expect(JSON.parse(openInit.body).recipient_id).toBe('111222333');

    const [msgUrl, msgInit] = mockFetch.mock.calls[1];
    expect(msgUrl).toBe('https://discord.com/api/v10/channels/dm_channel_1/messages');
    expect(msgInit.method).toBe('POST');
    expect(msgInit.headers.Authorization).toBe('Bot DBOT');
    const msgBody = JSON.parse(msgInit.body);
    expect(msgBody.embeds).toBeDefined();
    expect(Array.isArray(msgBody.embeds)).toBe(true);
    expect(msgBody.components).toBeDefined();
  });

  it('caches the DM channel id: two consecutive calls open the DM ONCE', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ id: 'dm_channel_1' }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 }) // msg #1
      .mockResolvedValueOnce({ ok: true, status: 200 }); // msg #2 — no new DM open

    const { fireDiscordApproval } = await loadModule();
    await fireDiscordApproval(pendingAction, null, 'org_1');
    await fireDiscordApproval(pendingAction, null, 'org_1');

    // Exactly 3 fetches total: 1 open + 2 messages.
    expect(mockFetch).toHaveBeenCalledTimes(3);
    const openCalls = mockFetch.mock.calls.filter(
      ([u]) => u.endsWith('/users/@me/channels'),
    );
    expect(openCalls).toHaveLength(1);
  });
});

describe('fireDiscordApproval — fire-and-forget', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    process.env.DISCORD_BOT_TOKEN = 'DBOT';
    process.env.DISCORD_APPROVER_USER_ID = '111222333';
    delete process.env.DASHCLAW_ALERTS_DISCORD;
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('does not throw when fetch rejects (network down)', async () => {
    mockFetch.mockRejectedValue(new Error('network down'));
    const { fireDiscordApproval } = await loadModule();
    await expect(fireDiscordApproval(pendingAction, null, 'org_1')).resolves.not.toThrow();
  });

  it('does not throw when DM channel open returns non-ok', async () => {
    mockFetch.mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    const { fireDiscordApproval } = await loadModule();
    await expect(fireDiscordApproval(pendingAction, null, 'org_1')).resolves.not.toThrow();
  });

  it('does not throw when message send returns 403 (user blocked DMs)', async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true, status: 200, json: async () => ({ id: 'dm_channel_1' }),
      })
      .mockResolvedValueOnce({ ok: false, status: 403 });
    const { fireDiscordApproval } = await loadModule();
    await expect(fireDiscordApproval(pendingAction, null, 'org_1')).resolves.not.toThrow();
  });
});
