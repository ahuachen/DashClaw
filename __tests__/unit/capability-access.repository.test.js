import { describe, expect, it } from 'vitest';
import { shapeAccessRule } from '../../app/lib/repositories/capability-access.repository.js';

describe('shapeAccessRule', () => {
  it('shapes a raw row into a rule object', () => {
    const row = {
      rule_id: 'car_1',
      org_id: 'org_1',
      capability_id: 'cap_1',
      agent_id: 'bot_1',
      access: 'deny',
      reason: 'Production only',
      created_by: 'admin',
      created_at: '2026-04-09T10:00:00Z',
    };

    const rule = shapeAccessRule(row);
    expect(rule.rule_id).toBe('car_1');
    expect(rule.access).toBe('deny');
    expect(rule.agent_id).toBe('bot_1');
    expect(rule.reason).toBe('Production only');
  });

  it('handles null agent_id for org-wide rules', () => {
    const row = {
      rule_id: 'car_2',
      org_id: 'org_1',
      capability_id: 'cap_1',
      agent_id: null,
      access: 'require_approval',
      reason: null,
    };

    const rule = shapeAccessRule(row);
    expect(rule.agent_id).toBeNull();
    expect(rule.access).toBe('require_approval');
    expect(rule.reason).toBeNull();
  });

  it('returns null for null input', () => {
    expect(shapeAccessRule(null)).toBeNull();
  });
});
