import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { DashClaw, ApprovalDeniedError } from '../../sdk/dashclaw.js';

function createSSEStream(frames) {
  const encoder = new TextEncoder();
  const chunks = frames.map(f => {
    let text = '';
    if (f.id) text += `id: ${f.id}\n`;
    if (f.event) text += `event: ${f.event}\n`;
    if (f.data) text += `data: ${JSON.stringify(f.data)}\n`;
    text += '\n';
    return encoder.encode(text);
  });
  let index = 0;
  return new ReadableStream({
    pull(controller) {
      if (index < chunks.length) {
        controller.enqueue(chunks[index++]);
      } else {
        controller.close();
      }
    },
  });
}

function mockSSEResponse(frames) {
  return {
    ok: true,
    status: 200,
    headers: new Headers({ 'content-type': 'text/event-stream' }),
    body: createSSEStream(frames),
  };
}

function mockJSONResponse(data, ok = true, status = 200) {
  return {
    ok,
    status,
    headers: new Headers({ 'content-type': 'application/json' }),
    json: async () => data,
  };
}

describe('SSE-powered waitForApproval', () => {
  let claw;

  beforeEach(() => {
    claw = new DashClaw({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      agentId: 'test-agent',
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it('resolves via SSE when action.updated contains approved_by', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'connected', data: { status: 'ok' } },
        { event: 'action.updated', data: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' }, id: 'evt_1' },
      ]))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('falls back to polling when SSE returns non-200', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce({ ok: false, status: 503, headers: new Headers() })
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000, interval: 100 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('falls back to polling when SSE fetch throws', async () => {
    global.fetch = vi.fn()
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000, interval: 100 });
    expect(result.action.approved_by).toBe('usr_admin');
  });

  it('throws ApprovalDeniedError on denial via SSE', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'action.updated', data: { action_id: 'act_123', status: 'cancelled', error_message: 'Denied by ops' }, id: 'evt_1' },
      ]))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'cancelled', error_message: 'Denied by ops' } }));

    await expect(claw.waitForApproval('act_123', { timeout: 5000 }))
      .rejects.toThrow(ApprovalDeniedError);
  });

  it('ignores SSE events for other action IDs', async () => {
    global.fetch = vi.fn()
      .mockResolvedValueOnce(mockSSEResponse([
        { event: 'action.updated', data: { action_id: 'act_OTHER', status: 'running', approved_by: 'usr_1' }, id: 'evt_1' },
        { event: 'action.updated', data: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' }, id: 'evt_2' },
      ]))
      .mockResolvedValueOnce(mockJSONResponse({ action: { action_id: 'act_123', status: 'running', approved_by: 'usr_admin' } }));

    const result = await claw.waitForApproval('act_123', { timeout: 5000 });
    expect(result.action.approved_by).toBe('usr_admin');
  });
});
