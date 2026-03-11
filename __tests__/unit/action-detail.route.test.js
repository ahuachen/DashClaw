import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const {
  mockSql,
  mockValidateActionOutcome,
  mockGetActionWithRelations,
  mockUpdateActionOutcome,
  mockPublishOrgEvent,
  mockScanSensitiveData,
  mockScoreAndStoreActionEpisode,
  mockRecordLearningRecommendationEvents,
} = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockValidateActionOutcome: vi.fn(),
  mockGetActionWithRelations: vi.fn(),
  mockUpdateActionOutcome: vi.fn(),
  mockPublishOrgEvent: vi.fn(),
  mockScanSensitiveData: vi.fn(),
  mockScoreAndStoreActionEpisode: vi.fn(),
  mockRecordLearningRecommendationEvents: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/validate.js', () => ({ validateActionOutcome: mockValidateActionOutcome }));
vi.mock('@/lib/org.js', () => ({ getOrgId: () => 'org_test' }));
vi.mock('@/lib/events.js', () => ({
  EVENTS: { ACTION_UPDATED: 'action.updated' },
  publishOrgEvent: mockPublishOrgEvent,
}));
vi.mock('@/lib/security.js', () => ({ scanSensitiveData: mockScanSensitiveData }));
vi.mock('@/lib/repositories/actions.repository.js', () => ({
  getActionWithRelations: mockGetActionWithRelations,
  updateActionOutcome: mockUpdateActionOutcome,
}));
vi.mock('@/lib/learningLoop.service.js', () => ({
  scoreAndStoreActionEpisode: mockScoreAndStoreActionEpisode,
  recordLearningRecommendationEvents: mockRecordLearningRecommendationEvents,
}));

import { GET, PATCH } from '@/api/actions/[actionId]/route.js';

function req(body) {
  return makeRequest('http://localhost/api/actions/act_1', {
    headers: { 'x-org-id': 'org_test' },
    body,
  });
}

const routeCtx = { params: Promise.resolve({ actionId: 'act_1' }) };

describe('/api/actions/[actionId]', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockScanSensitiveData.mockReturnValue({ clean: true, redacted: '', findings: [] });
    mockScoreAndStoreActionEpisode.mockResolvedValue(null);
    mockRecordLearningRecommendationEvents.mockResolvedValue(undefined);
  });

  describe('GET', () => {
    it('returns 200 with action data', async () => {
      mockGetActionWithRelations.mockResolvedValue({ action_id: 'act_1', status: 'completed' });
      const res = await GET(req(), routeCtx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.action_id).toBe('act_1');
    });

    it('returns 404 when action not found', async () => {
      mockGetActionWithRelations.mockResolvedValue(null);
      const res = await GET(req(), routeCtx);
      expect(res.status).toBe(404);
    });

    it('returns 500 on DB error', async () => {
      mockGetActionWithRelations.mockRejectedValue(new Error('db down'));
      const res = await GET(req(), routeCtx);
      expect(res.status).toBe(500);
    });
  });

  describe('PATCH', () => {
    it('returns 400 on validation failure', async () => {
      mockValidateActionOutcome.mockReturnValue({ valid: false, errors: ['status required'] });
      const res = await PATCH(req({ bad: true }), routeCtx);
      expect(res.status).toBe(400);
      const data = await res.json();
      expect(data.details).toContain('status required');
    });

    it('returns 404 when action not found', async () => {
      mockValidateActionOutcome.mockReturnValue({ valid: true, data: { status: 'completed' }, errors: [] });
      mockUpdateActionOutcome.mockResolvedValue(null);
      const res = await PATCH(req({ status: 'completed' }), routeCtx);
      expect(res.status).toBe(404);
    });

    it('returns 200 and publishes SSE event on success', async () => {
      const updated = { action_id: 'act_1', status: 'completed', agent_id: 'a1' };
      mockValidateActionOutcome.mockReturnValue({ valid: true, data: { status: 'completed' }, errors: [] });
      mockUpdateActionOutcome.mockResolvedValue(updated);

      const res = await PATCH(req({ status: 'completed' }), routeCtx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.action.status).toBe('completed');

      // Verify SSE event was published
      expect(mockPublishOrgEvent).toHaveBeenCalledWith('action.updated', {
        orgId: 'org_test',
        action: updated,
      });
    });

    it('redacts sensitive data in output_summary via DLP', async () => {
      mockScanSensitiveData.mockReturnValue({
        clean: false,
        redacted: '[REDACTED]',
        findings: [{ category: 'api_key', severity: 'critical' }],
      });
      mockValidateActionOutcome.mockReturnValue({
        valid: true,
        data: { status: 'completed', output_summary: 'key=sk_live_abc123' },
        errors: [],
      });
      mockUpdateActionOutcome.mockResolvedValue({ action_id: 'act_1', status: 'completed' });

      const res = await PATCH(req({ status: 'completed', output_summary: 'key=sk_live_abc123' }), routeCtx);
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.security.clean).toBe(false);
      expect(data.security.findings_count).toBe(1);
    });

    it('continues when learning scoring fails', async () => {
      mockValidateActionOutcome.mockReturnValue({ valid: true, data: { status: 'completed' }, errors: [] });
      mockUpdateActionOutcome.mockResolvedValue({ action_id: 'act_1', status: 'completed' });
      mockScoreAndStoreActionEpisode.mockRejectedValue(new Error('scoring broke'));

      const res = await PATCH(req({ status: 'completed' }), routeCtx);
      // Should still return 200 — learning is best-effort
      expect(res.status).toBe(200);
    });

    it('returns 500 on DB error', async () => {
      mockValidateActionOutcome.mockReturnValue({ valid: true, data: { status: 'completed' }, errors: [] });
      mockUpdateActionOutcome.mockRejectedValue(new Error('db down'));
      const res = await PATCH(req({ status: 'completed' }), routeCtx);
      expect(res.status).toBe(500);
    });
  });
});
