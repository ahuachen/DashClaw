import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import nacl from 'tweetnacl';
import { makeRequest } from '../helpers.js';

// ─── Local Ed25519 key pair for signing synthetic interactions ────────────────
// `DISCORD_PUBLIC_KEY` is set from KEYPAIR.publicKey (hex) in beforeEach so the
// route's verifyDiscordSignature accepts our signatures.
const KEYPAIR = nacl.sign.keyPair();
const DISCORD_PUBLIC_KEY_HEX = Buffer.from(KEYPAIR.publicKey).toString('hex');

function signDiscord(timestamp, rawBody) {
  // tweetnacl's checkArrayTypes is `instanceof Uint8Array` — under jsdom the
  // `Uint8Array` from `TextEncoder().encode(...)` and from Node's `Buffer`
  // does NOT satisfy `instanceof Uint8Array` because jsdom installs its own
  // constructor. `Uint8Array.from(...)` forces the current realm's global.
  const msg = Uint8Array.from(new TextEncoder().encode(timestamp + rawBody));
  const sk = Uint8Array.from(KEYPAIR.secretKey);
  const sig = nacl.sign.detached(msg, sk);
  return Buffer.from(sig).toString('hex');
}

const {
  mockFetch,
  mockGetActionSummary,
  mockRecordApproval,
  afterCallbacks,
  mockAfter,
} = vi.hoisted(() => {
  const afterCallbacks = [];
  return {
    mockFetch: vi.fn(),
    mockGetActionSummary: vi.fn(),
    mockRecordApproval: vi.fn(),
    afterCallbacks,
    // Capture callbacks that the route hands to next/server's after().
    // Tests run them explicitly via flushAfter() to simulate post-response work.
    mockAfter: vi.fn((cb) => { afterCallbacks.push(cb); }),
  };
});

vi.stubGlobal('fetch', mockFetch);
vi.mock('next/server', async (importOriginal) => {
  const actual = await importOriginal();
  return { ...actual, after: (cb) => mockAfter(cb) };
});
vi.mock('../../app/lib/db.js', () => ({ getSql: () => ({}) }));
vi.mock('../../app/lib/repositories/actions.repository.js', () => ({
  getActionSummary: (...a) => mockGetActionSummary(...a),
  recordApproval: (...a) => mockRecordApproval(...a),
}));

const { POST } = await import('../../app/api/discord/interactions/route.js');

/**
 * Build a request whose .text() returns rawBody (Discord signs bytes, not the
 * parsed object). The route MUST call request.text() — never request.json().
 */
function signedRequest(bodyObj, { skipSig = false, badSig = false, skewSec = 0, headerOverrides = {} } = {}) {
  const rawBody = JSON.stringify(bodyObj);
  const ts = String(Math.floor(Date.now() / 1000) + skewSec);
  let sig;
  if (skipSig) {
    sig = null; // not used — headers omitted below
  } else if (badSig) {
    sig = '00'.repeat(64);
  } else {
    sig = signDiscord(ts, rawBody);
  }
  const headers = {
    'Content-Type': 'application/json',
    ...(skipSig ? {} : { 'X-Signature-Ed25519': sig, 'X-Signature-Timestamp': ts }),
    ...headerOverrides,
  };
  const req = makeRequest('http://localhost:3000/api/discord/interactions', {
    headers,
    body: bodyObj,
  });
  // Route uses request.text() (Pitfall 1 — JSON.parse re-serialization breaks signature).
  req.text = async () => rawBody;
  return req;
}

async function flushAfter() {
  const cbs = afterCallbacks.splice(0);
  for (const cb of cbs) {
    await cb();
  }
}

const ORIGINAL_ENV = { ...process.env };

function setEnv() {
  process.env.DISCORD_BOT_TOKEN = 'DBOT';
  process.env.DISCORD_PUBLIC_KEY = DISCORD_PUBLIC_KEY_HEX;
  process.env.DISCORD_APPROVER_USER_ID = '111222333';
  process.env.DISCORD_APPROVER_ORG_ID = 'org_discord';
}

describe('POST /api/discord/interactions — auth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns 401 when X-Signature-Ed25519 header is missing', async () => {
    const res = await POST(signedRequest({ type: 1 }, { skipSig: true }));
    expect(res.status).toBe(401);
    expect(mockGetActionSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when X-Signature-Timestamp header is missing', async () => {
    const body = JSON.stringify({ type: 1 });
    const ts = String(Math.floor(Date.now() / 1000));
    const req = makeRequest('http://localhost:3000/api/discord/interactions', {
      headers: {
        'Content-Type': 'application/json',
        'X-Signature-Ed25519': signDiscord(ts, body),
      },
      body: { type: 1 },
    });
    req.text = async () => body;

    const res = await POST(req);
    expect(res.status).toBe(401);
    expect(mockGetActionSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when signature does not verify against (timestamp + rawBody)', async () => {
    const res = await POST(signedRequest({ type: 1 }, { badSig: true }));
    expect(res.status).toBe(401);
    expect(mockGetActionSummary).not.toHaveBeenCalled();
  });

  it('returns 401 when signature is valid but body.user.id !== DISCORD_APPROVER_USER_ID', async () => {
    // Sender identity mismatch collapses to 401 (not 403) — mirrors Telegram
    // discipline; avoids leaking "signature correct but user wrong".
    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_1',
      data: { component_type: 2, custom_id: 'ap:act_abc12345' },
      user: { id: '999999' }, // NOT the approver
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(401);
    expect(mockRecordApproval).not.toHaveBeenCalled();
  });
});

describe('POST /api/discord/interactions — PING handshake', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns {type: 1} (PONG) for a signed type-1 PING', async () => {
    const res = await POST(signedRequest({ type: 1 }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.type).toBe(1);
  });
});

describe('POST /api/discord/interactions — callback_data validation', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('returns type 6 (DEFERRED_UPDATE_MESSAGE) and does NOT call repo for malformed custom_id', async () => {
    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_1',
      data: { component_type: 2, custom_id: 'WAT:act_abc' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.type).toBe(6);
    // Flush any after() callbacks — none should touch the repo.
    await flushAfter();
    expect(mockGetActionSummary).not.toHaveBeenCalled();
    expect(mockRecordApproval).not.toHaveBeenCalled();
  });
});

describe('POST /api/discord/interactions — approve path', () => {
  const pending = {
    action_id: 'act_abc12345',
    status: 'pending_approval',
    agent_id: 'claude-code',
    action_type: 'deploy',
    declared_goal: 'Deploy v0.4.2',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionSummary.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'running' });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('responds type 6 immediately and records approval (allow) via after()', async () => {
    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_approve',
      data: { component_type: 2, custom_id: 'ap:act_abc12345' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    const resBody = await res.json();
    expect(resBody.type).toBe(6);
    // Ack returned — now drain the after() queue to run DB work.
    await flushAfter();

    expect(mockGetActionSummary).toHaveBeenCalledWith(
      expect.anything(), 'org_discord', 'act_abc12345',
    );
    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_discord', 'act_abc12345',
      expect.objectContaining({
        decision: 'allow',
        newStatus: 'running',
        errorMessage: null,
        userId: 'discord:111222333',
      }),
    );

    // PATCH @original fires after DB resolve.
    const patchCall = mockFetch.mock.calls.find(([u, init]) =>
      u.includes('/webhooks/app_1/itoken_approve/messages/@original') &&
      init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    const patchBody = JSON.parse(patchCall[1].body);
    expect(patchBody.content).toContain('APPROVED');
    expect(patchBody.components).toEqual([]);
  });
});

describe('POST /api/discord/interactions — deny path', () => {
  const pending = {
    action_id: 'act_xyz99999',
    status: 'pending_approval',
    agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
  };

  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
    mockGetActionSummary.mockResolvedValue(pending);
    mockRecordApproval.mockResolvedValue({ ...pending, status: 'failed' });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('records deny with "Denied via Discord" reason + PATCH @original with DENIED', async () => {
    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_deny',
      data: { component_type: 2, custom_id: 'dn:act_xyz99999' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    await flushAfter();

    expect(mockRecordApproval).toHaveBeenCalledWith(
      expect.anything(), 'org_discord', 'act_xyz99999',
      expect.objectContaining({
        decision: 'deny',
        newStatus: 'failed',
        errorMessage: 'Denied via Discord',
        userId: 'discord:111222333',
      }),
    );
    const patchCall = mockFetch.mock.calls.find(([u, init]) =>
      u.includes('/webhooks/app_1/itoken_deny/messages/@original') &&
      init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body).content).toContain('DENIED');
  });
});

describe('POST /api/discord/interactions — idempotency', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('edits with "Already resolved" when action status is not pending_approval', async () => {
    mockGetActionSummary.mockResolvedValue({
      action_id: 'act_abc12345',
      status: 'completed',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });

    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_done',
      data: { component_type: 2, custom_id: 'ap:act_abc12345' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    await flushAfter();

    expect(mockRecordApproval).not.toHaveBeenCalled();
    const patchCall = mockFetch.mock.calls.find(([u, init]) =>
      u.includes('/webhooks/app_1/itoken_done/messages/@original') &&
      init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body).content).toContain('Already resolved');
  });

  it('edits with "resolved by another channel" when recordApproval returns null (race)', async () => {
    mockGetActionSummary.mockResolvedValue({
      action_id: 'act_abc12345',
      status: 'pending_approval',
      agent_id: 'a', action_type: 'deploy', declared_goal: 'g',
    });
    mockRecordApproval.mockResolvedValue(null);

    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_race',
      data: { component_type: 2, custom_id: 'ap:act_abc12345' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    await flushAfter();

    const patchCall = mockFetch.mock.calls.find(([u, init]) =>
      u.includes('/webhooks/app_1/itoken_race/messages/@original') &&
      init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body).content).toContain('resolved by another channel');
  });
});

describe('POST /api/discord/interactions — misconfig', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    afterCallbacks.length = 0;
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    setEnv();
    mockFetch.mockResolvedValue({ ok: true, status: 200 });
  });

  afterEach(() => {
    process.env = { ...ORIGINAL_ENV };
    vi.restoreAllMocks();
  });

  it('surfaces misconfig via PATCH @original when DISCORD_APPROVER_ORG_ID is unset', async () => {
    delete process.env.DISCORD_APPROVER_ORG_ID;

    const body = {
      type: 3,
      application_id: 'app_1',
      token: 'itoken_misconfig',
      data: { component_type: 2, custom_id: 'ap:act_abc12345' },
      user: { id: '111222333' },
    };
    const res = await POST(signedRequest(body));
    expect(res.status).toBe(200);
    await flushAfter();

    expect(mockGetActionSummary).not.toHaveBeenCalled();
    const patchCall = mockFetch.mock.calls.find(([u, init]) =>
      u.includes('/webhooks/app_1/itoken_misconfig/messages/@original') &&
      init?.method === 'PATCH',
    );
    expect(patchCall).toBeDefined();
    expect(JSON.parse(patchCall[1].body).content).toContain('misconfigured');
  });
});
