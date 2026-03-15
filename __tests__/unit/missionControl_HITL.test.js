import { describe, it, expect } from 'vitest';
import { buildAssumptionEvent, buildActionEvent, formatMissionStatus } from '../../app/lib/missionControl.js';

describe('Mission Control HITL/Assumption Distinction', () => {
  it('unresolved assumptions show as "Awaiting Validation"', () => {
    const assumption = {
      assumption_id: 'asm_1',
      assumption: 'The earth is flat',
      validated: 0,
      invalidated: 0
    };
    
    const event = buildAssumptionEvent(assumption);
    expect(event.status).toBe('unresolved_assumption');
    expect(event.statusLabel).toBe('Awaiting Validation');
  });

  it('pending approvals show as "Awaiting approval"', () => {
    const action = {
      action_id: 'act_1',
      status: 'pending_approval'
    };
    
    const event = buildActionEvent(action);
    expect(event.status).toBe('pending_approval');
    expect(event.statusLabel).toBe('Awaiting approval');
  });
});
