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
});
