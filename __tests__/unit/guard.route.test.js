import { beforeEach, describe, expect, it, vi } from 'vitest';
import { makeRequest } from '../helpers.js';

const { mockSql, mockValidateGuardInput, mockEvaluateGuard } = vi.hoisted(() => ({
  mockSql: Object.assign(vi.fn(async () => []), { query: vi.fn(async () => []) }),
  mockValidateGuardInput: vi.fn(),
  mockEvaluateGuard: vi.fn(),
}));

vi.mock('@/lib/db.js', () => ({ getSql: () => mockSql }));
vi.mock('@/lib/validate', () => ({ validateGuardInput: mockValidateGuardInput }));
vi.mock('@/lib/guard', () => ({ evaluateGuard: mockEvaluateGuard }));

import { POST, GET } from '@/api/guard/route.js';

describe('/api/guard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DATABASE_URL = 'postgres://unit-test';
    mockSql.mockImplementation(async () => []);
    mockSql.query.mockImplementation(async () => []);
  });

  describe('POST', () => {
    it('returns 400 on validation failure', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: false, errors: ['action_type required'] });
      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: {},
      }));
      expect(res.status).toBe(400);
    });

    it('returns 200 for allow decision', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'read' }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'allow', reasons: [], warnings: [], matched_policies: [] });

      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: { action_type: 'read' },
      }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.decision).toBe('allow');
    });

    it('returns 200 for block decision', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'delete' }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'block', reasons: ['Blocked'], warnings: [], matched_policies: ['gp_1'] });

      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: { action_type: 'delete' },
      }));
      expect(res.status).toBe(200);
    });

    it('returns 200 for require_approval decision', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'deploy' }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'require_approval', reasons: ['Needs approval'], warnings: [], matched_policies: [] });

      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: { action_type: 'deploy' },
      }));
      expect(res.status).toBe(200);
    });

    it('returns 200 for warn decision', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'deploy' }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'warn', reasons: [], warnings: ['Rate limit approaching'], matched_policies: [] });

      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: { action_type: 'deploy' },
      }));
      expect(res.status).toBe(200);
    });

    it('passes include_signals option', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'read' }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'allow', reasons: [], warnings: [], matched_policies: [] });

      await POST(makeRequest('http://localhost/api/guard?include_signals=true', {
        headers: { 'x-org-id': 'org_1' },
        body: { action_type: 'read' },
      }));
      expect(mockEvaluateGuard).toHaveBeenCalledWith(
        'org_1',
        { action_type: 'read' },
        mockSql,
        expect.objectContaining({ includeSignals: true })
      );
    });

    it('calls evaluateGuard with org_id and context', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: { action_type: 'deploy', risk_score: 50 }, errors: [] });
      mockEvaluateGuard.mockResolvedValue({ decision: 'allow', reasons: [], warnings: [], matched_policies: [] });

      await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_42' },
        body: { action_type: 'deploy', risk_score: 50 },
      }));
      expect(mockEvaluateGuard).toHaveBeenCalledWith('org_42', { action_type: 'deploy', risk_score: 50 }, mockSql, expect.any(Object));
    });

    it('returns 500 on internal error', async () => {
      mockValidateGuardInput.mockReturnValue({ valid: true, data: {}, errors: [] });
      mockEvaluateGuard.mockRejectedValue(new Error('engine fail'));

      const res = await POST(makeRequest('http://localhost/api/guard', {
        headers: { 'x-org-id': 'org_1' },
        body: {},
      }));
      expect(res.status).toBe(500);
    });
  });

  describe('GET', () => {
    it('returns guard decisions with pagination', async () => {
      const decisions = [{ id: 'gd_1', decision: 'block' }];
      mockSql.query.mockResolvedValueOnce(decisions).mockResolvedValueOnce([{ total: '1' }]);
      mockSql.mockResolvedValueOnce([{ total_24h: 5, blocks_24h: 2, warns_24h: 1, approvals_24h: 1 }]);

      const res = await GET(makeRequest('http://localhost/api/guard', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(200);
      const data = await res.json();
      expect(data.decisions).toEqual(decisions);
      expect(data.total).toBe(1);
    });

    it('filters by agent_id', async () => {
      mockSql.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      mockSql.mockResolvedValueOnce([{}]);

      await GET(makeRequest('http://localhost/api/guard?agent_id=a1', { headers: { 'x-org-id': 'org_1' } }));
      expect(mockSql.query.mock.calls[0][0]).toContain('agent_id');
    });

    it('filters by decision type', async () => {
      mockSql.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      mockSql.mockResolvedValueOnce([{}]);

      await GET(makeRequest('http://localhost/api/guard?decision=block', { headers: { 'x-org-id': 'org_1' } }));
      expect(mockSql.query.mock.calls[0][0]).toContain('decision');
    });

    it('includes 24h stats', async () => {
      mockSql.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      mockSql.mockResolvedValueOnce([{ total_24h: 10, blocks_24h: 3, warns_24h: 2, approvals_24h: 1 }]);

      const res = await GET(makeRequest('http://localhost/api/guard', { headers: { 'x-org-id': 'org_1' } }));
      const data = await res.json();
      expect(data.stats.total_24h).toBe(10);
    });

    it('respects limit and offset', async () => {
      mockSql.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      mockSql.mockResolvedValueOnce([{}]);

      const res = await GET(makeRequest('http://localhost/api/guard?limit=5&offset=10', { headers: { 'x-org-id': 'org_1' } }));
      const data = await res.json();
      expect(data.limit).toBe(5);
      expect(data.offset).toBe(10);
    });

    it('caps limit at 1000', async () => {
      mockSql.query.mockResolvedValueOnce([]).mockResolvedValueOnce([{ total: '0' }]);
      mockSql.mockResolvedValueOnce([{}]);

      const res = await GET(makeRequest('http://localhost/api/guard?limit=5000', { headers: { 'x-org-id': 'org_1' } }));
      const data = await res.json();
      expect(data.limit).toBe(1000);
    });

    it('returns 500 on error', async () => {
      mockSql.query.mockRejectedValueOnce(new Error('db fail'));
      const res = await GET(makeRequest('http://localhost/api/guard', { headers: { 'x-org-id': 'org_1' } }));
      expect(res.status).toBe(500);
    });
  });
});
