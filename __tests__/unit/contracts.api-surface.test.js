import { describe, expect, it } from 'vitest';
import { checkApiSurface } from '../../scripts/lib/contracts/check-api-surface.mjs';

describe('checkApiSurface', () => {
  it('fails when a discovered route in a covered domain is missing from the contract', async () => {
    const result = await checkApiSurface({
      api: {
        capabilities: {
          route_root: 'app/api/capabilities',
          routes: [
            {
              file: 'app/api/capabilities/route.js',
              path: '/api/capabilities',
              methods: ['GET', 'POST'],
            },
          ],
        },
      },
    }, {
      capabilities: [
        { file: 'app/api/capabilities/route.js', methods: ['GET', 'POST'] },
        { file: 'app/api/capabilities/health/route.js', methods: ['GET'] },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_api_route');
    expect(result.findings[0].message).toMatch(/health\/route\.js/i);
  });

  it('fails when a declared route methods do not match the file exports', async () => {
    const result = await checkApiSurface({
      api: {
        capabilities: {
          route_root: 'app/api/capabilities',
          routes: [
            {
              file: 'app/api/capabilities/route.js',
              path: '/api/capabilities',
              methods: ['GET'],
            },
          ],
        },
      },
    }, {
      capabilities: [
        { file: 'app/api/capabilities/route.js', methods: ['GET', 'POST'] },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('api_method_mismatch');
    expect(result.findings[0].message).toMatch(/POST/i);
  });

  it('passes when declared routes match the discovered domain files', async () => {
    const result = await checkApiSurface({
      api: {
        capabilities: {
          route_root: 'app/api/capabilities',
          routes: [
            {
              file: 'app/api/capabilities/route.js',
              path: '/api/capabilities',
              methods: ['GET', 'POST'],
            },
            {
              file: 'app/api/capabilities/health/route.js',
              path: '/api/capabilities/health',
              methods: ['GET'],
            },
          ],
        },
      },
    }, {
      capabilities: [
        { file: 'app/api/capabilities/route.js', methods: ['GET', 'POST'] },
        { file: 'app/api/capabilities/health/route.js', methods: ['GET'] },
      ],
    });

    expect(result.ok).toBe(true);
    expect(result.findings).toEqual([]);
  });

  it('fails when a discovered knowledge route is missing from the contract', async () => {
    const result = await checkApiSurface({
      api: {
        'knowledge-collections': {
          route_root: 'app/api/knowledge/collections',
          routes: [
            {
              file: 'app/api/knowledge/collections/route.js',
              path: '/api/knowledge/collections',
              methods: ['GET', 'POST'],
            },
          ],
        },
      },
    }, {
      'knowledge-collections': [
        { file: 'app/api/knowledge/collections/route.js', methods: ['GET', 'POST'] },
        { file: 'app/api/knowledge/collections/[collectionId]/sync/route.js', methods: ['POST'] },
      ],
    });

    expect(result.ok).toBe(false);
    expect(result.findings[0].code).toBe('undeclared_api_route');
    expect(result.findings[0].message).toMatch(/sync\/route\.js/i);
  });
});
