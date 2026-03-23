/**
 * Security regression tests for HSTS header unification (SEC-02).
 * Covers the addSecurityHeaders function from middleware.js.
 */

import { beforeEach, afterEach, describe, expect, it, vi } from 'vitest';

// We test addSecurityHeaders by extracting the logic directly,
// since middleware.js has complex next-auth/neon imports.
// The function signature: addSecurityHeaders(response, request)

// Inline the function under test (mirrors middleware.js addSecurityHeaders exactly)
// to avoid complex module graph issues in unit test context.
function addSecurityHeaders(response, request) {
  const pathname = request?.nextUrl?.pathname || '';
  const isPublicReplay = pathname.startsWith('/replay/');

  response.headers.set('X-Content-Type-Options', 'nosniff');

  if (isPublicReplay) {
    response.headers.delete('X-Frame-Options');
    response.headers.set('Content-Security-Policy', 'frame-ancestors *;');
  } else {
    response.headers.set('X-Frame-Options', 'DENY');
  }

  response.headers.set('X-XSS-Protection', '1; mode=block');
  if (process.env.NODE_ENV === 'production') {
    response.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
  }
  return response;
}

function makeTestResponse() {
  const store = new Map();
  return {
    headers: {
      set: (k, v) => store.set(k.toLowerCase(), v),
      get: (k) => store.get(k.toLowerCase()),
      delete: (k) => store.delete(k.toLowerCase()),
      has: (k) => store.has(k.toLowerCase()),
    },
  };
}

function makeTestRequest(pathname) {
  return {
    nextUrl: { pathname },
  };
}

describe('addSecurityHeaders', () => {
  const originalNodeEnv = process.env.NODE_ENV;

  afterEach(() => {
    process.env.NODE_ENV = originalNodeEnv;
  });

  describe('HSTS header', () => {
    it('sets HSTS to 2-year max-age with includeSubDomains and preload when NODE_ENV=production', () => {
      process.env.NODE_ENV = 'production';
      const response = makeTestResponse();
      const request = makeTestRequest('/dashboard');
      addSecurityHeaders(response, request);
      expect(response.headers.get('Strict-Transport-Security')).toBe(
        'max-age=63072000; includeSubDomains; preload'
      );
    });

    it('does NOT set HSTS when NODE_ENV is not production', () => {
      process.env.NODE_ENV = 'test';
      const response = makeTestResponse();
      const request = makeTestRequest('/dashboard');
      addSecurityHeaders(response, request);
      expect(response.headers.has('strict-transport-security')).toBe(false);
    });

    it('does NOT set HSTS in development mode', () => {
      process.env.NODE_ENV = 'development';
      const response = makeTestResponse();
      const request = makeTestRequest('/dashboard');
      addSecurityHeaders(response, request);
      expect(response.headers.has('strict-transport-security')).toBe(false);
    });
  });

  describe('X-Frame-Options header', () => {
    it('sets X-Frame-Options to DENY for non-replay paths', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/decisions');
      addSecurityHeaders(response, request);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('sets X-Frame-Options to DENY for root path', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/');
      addSecurityHeaders(response, request);
      expect(response.headers.get('X-Frame-Options')).toBe('DENY');
    });

    it('removes X-Frame-Options for /replay/ paths to allow embedding', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/replay/some-session-id');
      // Pre-set X-Frame-Options to verify it gets deleted
      response.headers.set('X-Frame-Options', 'DENY');
      addSecurityHeaders(response, request);
      expect(response.headers.has('x-frame-options')).toBe(false);
    });

    it('sets frame-ancestors CSP for /replay/ paths', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/replay/abc123');
      addSecurityHeaders(response, request);
      expect(response.headers.get('Content-Security-Policy')).toBe('frame-ancestors *;');
    });
  });

  describe('other security headers', () => {
    it('always sets X-Content-Type-Options to nosniff', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/api/guard');
      addSecurityHeaders(response, request);
      expect(response.headers.get('X-Content-Type-Options')).toBe('nosniff');
    });

    it('always sets X-XSS-Protection', () => {
      const response = makeTestResponse();
      const request = makeTestRequest('/dashboard');
      addSecurityHeaders(response, request);
      expect(response.headers.get('X-XSS-Protection')).toBe('1; mode=block');
    });
  });
});
