import { describe, it, expect, vi, beforeEach } from 'vitest';
import { DashClaw, ApprovalDeniedError } from '../../sdk/dashclaw.js';

describe('HITL Approval Flow', () => {
  let claw;
  
  beforeEach(() => {
    claw = new DashClaw({
      baseUrl: 'http://localhost:3000',
      apiKey: 'test-key',
      agentId: 'test-agent'
    });
    
    // Mock global fetch
    global.fetch = vi.fn();
  });

  it('waitForApproval resolves only on explicit approval metadata', async () => {
    // 1. First poll: pending_approval
    // 2. Second poll: running (without metadata) -> should THROW
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: { action_id: 'act_1', status: 'pending_approval' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: { action_id: 'act_1', status: 'running' } }) // No approved_by
      });

    await expect(claw.waitForApproval('act_1', { interval: 1, timeout: 100 }))
      .rejects.toThrow(/explicit approval metadata/);
  });

  it('waitForApproval resolves when approved_by is present', async () => {
    fetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ action: { action_id: 'act_1', status: 'pending_approval' } })
      })
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ 
          action: { 
            action_id: 'act_1', 
            status: 'running',
            approved_by: 'usr_123'
          } 
        })
      });

    const action = await claw.waitForApproval('act_1', { interval: 1, timeout: 100 });
    expect(action.approved_by).toBe('usr_123');
  });

  it('waitForApproval throws ApprovalDeniedError on failed status', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        action: { 
          action_id: 'act_1', 
          status: 'failed',
          error_message: 'Denied by human'
        } 
      })
    });

    await expect(claw.waitForApproval('act_1', { interval: 1, timeout: 100 }))
      .rejects.toThrow(ApprovalDeniedError);
  });

  it('ApprovalDeniedError includes decision property', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ 
        action: { 
          action_id: 'act_1', 
          status: 'cancelled',
          error_message: 'Operator cancelled.'
        } 
      })
    });

    try {
      await claw.waitForApproval('act_1', { interval: 1, timeout: 100 });
    } catch (error) {
      expect(error).toBeInstanceOf(ApprovalDeniedError);
      expect(error.decision).toBe('cancelled');
    }
  });

  it('throws timeout error when action stays pending_approval', async () => {
    fetch.mockResolvedValue({
      ok: true,
      json: async () => ({ action: { action_id: 'act_2', status: 'pending_approval' } })
    });

    await expect(claw.waitForApproval('act_2', { interval: 1, timeout: 25 }))
      .rejects.toThrow(/Timed out waiting for approval of action act_2/);
  });

  it('returns immediately when action is already running (never pending)', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ action: { action_id: 'act_3', status: 'running' } })
    });

    const result = await claw.waitForApproval('act_3', { interval: 1, timeout: 100 });
    expect(result.action.status).toBe('running');
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it('polls multiple cycles before resolving on approval', async () => {
    const pending = {
      ok: true,
      json: async () => ({ action: { action_id: 'act_4', status: 'pending_approval' } })
    };

    fetch
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce(pending)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          action: { action_id: 'act_4', status: 'running', approved_by: 'usr_456' }
        })
      });

    const action = await claw.waitForApproval('act_4', { interval: 1, timeout: 5000 });
    expect(action.approved_by).toBe('usr_456');
    expect(fetch).toHaveBeenCalledTimes(4);
  });

  it('propagates network errors from fetch', async () => {
    fetch.mockRejectedValueOnce(new Error('Network failure'));

    await expect(claw.waitForApproval('act_5', { interval: 1, timeout: 100 }))
      .rejects.toThrow('Network failure');
  });

  it('throws ApprovalDeniedError with custom message on cancelled status', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        action: {
          action_id: 'act_6',
          status: 'cancelled',
          error_message: 'Budget limit exceeded'
        }
      })
    });

    await expect(claw.waitForApproval('act_6', { interval: 1, timeout: 100 }))
      .rejects.toThrow(ApprovalDeniedError);

    try {
      fetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          action: {
            action_id: 'act_6',
            status: 'cancelled',
            error_message: 'Budget limit exceeded'
          }
        })
      });
      await claw.waitForApproval('act_6', { interval: 1, timeout: 100 });
    } catch (error) {
      expect(error.message).toBe('Budget limit exceeded');
      expect(error.decision).toBe('cancelled');
    }
  });

  it('works with default options when no options object is provided', async () => {
    fetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        action: { action_id: 'act_7', status: 'running' }
      })
    });

    const result = await claw.waitForApproval('act_7');
    expect(result.action.status).toBe('running');
  });
});
