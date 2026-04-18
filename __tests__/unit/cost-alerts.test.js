import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSettings,
  mockFireWebhooksForOrg,
  mockDeliverNativeNotifications,
  mockPublishOrgEvent,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(),
  mockFireWebhooksForOrg: vi.fn(async () => []),
  mockDeliverNativeNotifications: vi.fn(async () => []),
  mockPublishOrgEvent: vi.fn(async () => {}),
}));

vi.mock('@/lib/repositories/settings.repository.js', () => ({ getSettings: mockGetSettings }));
vi.mock('@/lib/webhooks.js', () => ({ fireWebhooksForOrg: mockFireWebhooksForOrg }));
vi.mock('@/lib/notification-adapters/index.js', () => ({
  deliverNativeNotifications: mockDeliverNativeNotifications,
}));
vi.mock('@/lib/events.js', () => ({
  EVENTS: { ACTION_COST_EXCEEDED: 'action.cost_exceeded' },
  publishOrgEvent: mockPublishOrgEvent,
}));

import { parseThreshold, buildCostSignal, maybeFireCostAlert } from '@/lib/cost-alerts.js';

const sql = {};
const ORG = 'org_test';

function action(overrides = {}) {
  return {
    action_id: 'act_1',
    agent_id: 'agent_a',
    action_type: 'bash',
    cost_estimate: 0.5,
    ...overrides,
  };
}

// getSettings gets called twice on a fire (threshold lookup, then full bag
// for adapter creds). First call returns the threshold row, second returns
// the credential bag. Helper keeps the tests readable.
function arrangeSettings({ threshold, creds = [] }) {
  mockGetSettings.mockImplementation(async (_sql, _org, { key } = {}) => {
    if (key === 'DASHCLAW_ACTION_COST_THRESHOLD') {
      return threshold == null ? [] : [{ key, value: String(threshold) }];
    }
    return creds;
  });
}

describe('parseThreshold', () => {
  it('returns null for empty / null / bad values', () => {
    expect(parseThreshold(undefined)).toBe(null);
    expect(parseThreshold(null)).toBe(null);
    expect(parseThreshold('')).toBe(null);
    expect(parseThreshold('not a number')).toBe(null);
    expect(parseThreshold('0')).toBe(null);
    expect(parseThreshold('-5')).toBe(null);
  });

  it('returns the number for valid strings', () => {
    expect(parseThreshold('1.5')).toBe(1.5);
    expect(parseThreshold('100')).toBe(100);
    expect(parseThreshold(2.25)).toBe(2.25);
  });
});

describe('buildCostSignal', () => {
  it('marks the signal red once cost is ≥ 2× threshold', () => {
    const sig = buildCostSignal(action({ cost_estimate: 2.5 }), 1);
    expect(sig.type).toBe('cost_exceeded');
    expect(sig.severity).toBe('red');
    expect(sig.cost_estimate).toBe(2.5);
    expect(sig.threshold).toBe(1);
    expect(sig.action_id).toBe('act_1');
    expect(sig.agent_id).toBe('agent_a');
  });

  it('marks the signal amber for modest overages', () => {
    const sig = buildCostSignal(action({ cost_estimate: 1.2 }), 1);
    expect(sig.severity).toBe('amber');
  });
});

describe('maybeFireCostAlert', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFireWebhooksForOrg.mockResolvedValue([]);
    mockDeliverNativeNotifications.mockResolvedValue([]);
  });

  it('returns fired:false when no threshold is configured', async () => {
    arrangeSettings({ threshold: null });
    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: 999 }));
    expect(res.fired).toBe(false);
    expect(mockFireWebhooksForOrg).not.toHaveBeenCalled();
    expect(mockDeliverNativeNotifications).not.toHaveBeenCalled();
    expect(mockPublishOrgEvent).not.toHaveBeenCalled();
  });

  it('returns fired:false when cost is ≤ threshold', async () => {
    arrangeSettings({ threshold: 1 });
    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: 1 }));
    expect(res.fired).toBe(false);
    expect(mockFireWebhooksForOrg).not.toHaveBeenCalled();
  });

  it('returns fired:false when cost_estimate is missing', async () => {
    arrangeSettings({ threshold: 1 });
    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: null }));
    expect(res.fired).toBe(false);
  });

  it('fires webhooks, adapters, and SSE event when cost exceeds threshold', async () => {
    arrangeSettings({ threshold: 1, creds: [{ key: 'SLACK_WEBHOOK_URL', value: 'https://hooks' }] });
    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: 2.5 }));

    expect(res.fired).toBe(true);
    expect(res.threshold).toBe(1);
    expect(res.signal.type).toBe('cost_exceeded');
    expect(res.signal.severity).toBe('red');

    // Webhook + native delivery are fire-and-forget — allow the microtasks
    // they scheduled to run before asserting.
    await new Promise((r) => setImmediate(r));

    expect(mockFireWebhooksForOrg).toHaveBeenCalledTimes(1);
    const [whOrg, whSignals] = mockFireWebhooksForOrg.mock.calls[0];
    expect(whOrg).toBe(ORG);
    expect(whSignals).toHaveLength(1);
    expect(whSignals[0].type).toBe('cost_exceeded');

    expect(mockDeliverNativeNotifications).toHaveBeenCalledTimes(1);
    const [, signals, settingsArg] = mockDeliverNativeNotifications.mock.calls[0];
    expect(signals[0].type).toBe('cost_exceeded');
    // settings arg carries the credential bag, not the threshold-only row.
    expect(settingsArg).toEqual([{ key: 'SLACK_WEBHOOK_URL', value: 'https://hooks' }]);

    expect(mockPublishOrgEvent).toHaveBeenCalledWith(
      'action.cost_exceeded',
      expect.objectContaining({ orgId: ORG, threshold: 1 }),
    );
  });

  it('swallows errors from settings lookup', async () => {
    mockGetSettings.mockRejectedValue(new Error('db down'));
    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: 999 }));
    expect(res.fired).toBe(false);
    // Nothing delivered.
    expect(mockFireWebhooksForOrg).not.toHaveBeenCalled();
  });

  it('still reports fired:true even when webhook delivery throws', async () => {
    arrangeSettings({ threshold: 1 });
    mockFireWebhooksForOrg.mockRejectedValue(new Error('network boom'));

    const res = await maybeFireCostAlert(sql, ORG, action({ cost_estimate: 2 }));
    // The caller knows we detected a breach; downstream delivery failure
    // is logged but doesn't change the signal outcome.
    expect(res.fired).toBe(true);
    await new Promise((r) => setImmediate(r));
  });
});
