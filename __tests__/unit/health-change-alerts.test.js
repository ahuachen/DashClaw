import { beforeEach, describe, expect, it, vi } from 'vitest';

const {
  mockGetSettings,
  mockFireWebhooksForOrg,
  mockDeliverNativeNotifications,
  mockPublishOrgEvent,
} = vi.hoisted(() => ({
  mockGetSettings: vi.fn(async () => []),
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
  EVENTS: { SIGNAL_DETECTED: 'signal.detected' },
  publishOrgEvent: mockPublishOrgEvent,
}));

import {
  severityFor,
  buildHealthChangeSignal,
  fireHealthChangeAlerts,
} from '@/lib/health-change-alerts.js';

describe('severityFor', () => {
  it('any -> error is red', () => {
    expect(severityFor('healthy', 'error')).toBe('red');
    expect(severityFor('degraded', 'error')).toBe('red');
  });
  it('any -> degraded is amber', () => {
    expect(severityFor('healthy', 'degraded')).toBe('amber');
  });
  it('broken -> healthy is amber (recovery)', () => {
    expect(severityFor('error', 'healthy')).toBe('amber');
    expect(severityFor('degraded', 'healthy')).toBe('amber');
  });
  it('returns null for healthy -> healthy noise', () => {
    expect(severityFor('healthy', 'healthy')).toBe(null);
  });
});

describe('buildHealthChangeSignal', () => {
  it('produces a breakage signal when going to error', () => {
    const sig = buildHealthChangeSignal({
      provider: 'slack', prev_status: 'healthy', new_status: 'error', message: '401',
    });
    expect(sig.type).toBe('integration_health_changed');
    expect(sig.severity).toBe('red');
    expect(sig.label).toContain('slack');
    expect(sig.detail).toContain('healthy');
    expect(sig.detail).toContain('error');
    expect(sig.detail).toContain('401');
    expect(sig.provider).toBe('slack');
  });

  it('produces a recovery signal when going back to healthy', () => {
    const sig = buildHealthChangeSignal({
      provider: 'discord', prev_status: 'error', new_status: 'healthy', message: 'ok',
    });
    expect(sig.severity).toBe('amber');
    expect(sig.label).toContain('recovered');
    expect(sig.detail).toContain('was error');
  });

  it('returns null for non-deliverable transitions', () => {
    expect(
      buildHealthChangeSignal({ provider: 'x', prev_status: 'healthy', new_status: 'healthy' }),
    ).toBe(null);
  });
});

describe('fireHealthChangeAlerts', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSettings.mockResolvedValue([]);
    mockFireWebhooksForOrg.mockResolvedValue([]);
    mockDeliverNativeNotifications.mockResolvedValue([]);
  });

  it('returns fired:0 for empty / non-deliverable input', async () => {
    expect((await fireHealthChangeAlerts({}, 'org_test', [])).fired).toBe(0);
    expect(
      (await fireHealthChangeAlerts({}, 'org_test', [
        { provider: 'x', prev_status: 'healthy', new_status: 'healthy' },
      ])).fired,
    ).toBe(0);
    expect(mockFireWebhooksForOrg).not.toHaveBeenCalled();
  });

  it('delivers batched signals to webhooks, adapters, and SSE', async () => {
    const res = await fireHealthChangeAlerts({}, 'org_test', [
      { provider: 'slack', prev_status: 'healthy', new_status: 'error', message: '401' },
      { provider: 'discord', prev_status: 'error', new_status: 'healthy', message: 'ok' },
    ]);
    expect(res.fired).toBe(2);
    // Let the fire-and-forget microtasks run.
    await new Promise((r) => setImmediate(r));

    expect(mockFireWebhooksForOrg).toHaveBeenCalledTimes(1);
    const [, signals] = mockFireWebhooksForOrg.mock.calls[0];
    expect(signals).toHaveLength(2);
    expect(signals.map((s) => s.type)).toEqual([
      'integration_health_changed',
      'integration_health_changed',
    ]);

    expect(mockDeliverNativeNotifications).toHaveBeenCalledTimes(1);
    expect(mockPublishOrgEvent).toHaveBeenCalledWith(
      'signal.detected',
      expect.objectContaining({ orgId: 'org_test' }),
    );
  });

  it('swallows settings-lookup errors without throwing', async () => {
    mockGetSettings.mockRejectedValue(new Error('db down'));
    const res = await fireHealthChangeAlerts({}, 'org_test', [
      { provider: 'slack', prev_status: 'healthy', new_status: 'error' },
    ]);
    expect(res.fired).toBe(0);
  });
});
