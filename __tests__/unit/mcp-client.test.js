import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockFetch = vi.fn();
vi.stubGlobal('fetch', mockFetch);

const { DashClawClient } = await import('../../mcp-server/lib/client.js');

describe('DashClawClient', () => {
  let client;

  beforeEach(() => {
    vi.clearAllMocks();
    client = new DashClawClient({
      url: 'http://localhost:3000',
      apiKey: 'oc_live_test123',
    });
  });

  describe('constructor', () => {
    it('strips trailing slash from URL', () => {
      const c = new DashClawClient({ url: 'http://localhost:3000/', apiKey: 'k' });
      expect(c.baseUrl).toBe('http://localhost:3000');
    });

    it('uses defaults when no args provided', () => {
      const c = new DashClawClient({});
      expect(c.baseUrl).toBe('http://localhost:3000');
      expect(c.apiKey).toBe('');
    });
  });

  describe('post()', () => {
    it('sends POST with JSON body and x-api-key header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ decision: 'allow' }),
      });

      const result = await client.post('/api/guard', { action_type: 'deploy' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/guard',
        expect.objectContaining({
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'x-api-key': 'oc_live_test123',
          },
          body: JSON.stringify({ action_type: 'deploy' }),
        }),
      );
      expect(result).toEqual({ decision: 'allow' });
    });

    it('returns error object on non-OK response', async () => {
      mockFetch.mockResolvedValue({
        ok: false,
        status: 403,
        json: async () => ({ error: 'Forbidden' }),
      });

      const result = await client.post('/api/guard', {});
      expect(result).toEqual({ error: 'Forbidden', _status: 403 });
    });

    it('returns error object on network failure', async () => {
      mockFetch.mockRejectedValue(new Error('Connection refused'));

      const result = await client.post('/api/guard', {});
      expect(result).toEqual({ error: 'Connection refused', _status: 0 });
    });
  });

  describe('get()', () => {
    it('sends GET with query params and x-api-key header', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ policies: [] }),
      });

      const result = await client.get('/api/policies', { agent_id: 'bot1' });

      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/policies?agent_id=bot1',
        expect.objectContaining({
          method: 'GET',
          headers: { 'x-api-key': 'oc_live_test123' },
        }),
      );
      expect(result).toEqual({ policies: [] });
    });

    it('omits query string when params are empty', async () => {
      mockFetch.mockResolvedValue({
        ok: true,
        json: async () => ({ capabilities: [] }),
      });

      await client.get('/api/capabilities', {});
      expect(mockFetch).toHaveBeenCalledWith(
        'http://localhost:3000/api/capabilities',
        expect.anything(),
      );
    });
  });
});
