// tests/unit/setup.composeInstanceStatus.test.js
import { describe, it, expect } from 'vitest';
import { composeInstanceStatus } from '@/setup/composeInstanceStatus';

// Helpers to build raw inputs
function dbOk() {
  return { configured: true, message: 'Dashboard is configured' };
}
function dbNoUrl() {
  return { configured: false, reason: 'missing_database_url', message: 'DATABASE_URL is not set.' };
}
function dbConnErr() {
  return { configured: false, reason: 'connection_error', message: 'Unable to connect to database' };
}
function dbNoTables(missing = ['action_records', 'guard_decisions']) {
  return {
    configured: false,
    reason: 'no_tables',
    message: `Missing ${missing.length} core table(s). Run migrations.`,
    missing_tables: missing.length,
    missing,
  };
}
function authNone() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: false, hasLocalPassword: false,
    hasAnyOAuth: false, hasAnySignInMethod: false, oauthProviders: [],
  };
}
function authGitHub() {
  return {
    hasGitHub: true, hasGoogle: false, hasOIDC: false, hasLocalPassword: false,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'github', name: 'GitHub' }],
  };
}
function authLocalPassword() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: false, hasLocalPassword: true,
    hasAnyOAuth: false, hasAnySignInMethod: true, oauthProviders: [],
  };
}
function authOIDCCustomName() {
  return {
    hasGitHub: false, hasGoogle: false, hasOIDC: true, hasLocalPassword: false,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'oidc', name: 'Authentik' }],
  };
}
function authGitHubAndLocal() {
  return {
    hasGitHub: true, hasGoogle: false, hasOIDC: false, hasLocalPassword: true,
    hasAnyOAuth: true, hasAnySignInMethod: true,
    oauthProviders: [{ id: 'github', name: 'GitHub' }],
  };
}

describe('composeInstanceStatus', () => {
  describe('db state', () => {
    it('maps configured:false + missing_database_url to db.ok:false + reason', () => {
      const s = composeInstanceStatus(dbNoUrl(), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('missing_database_url');
    });

    it('maps configured:false + connection_error to db.ok:false + reason', () => {
      const s = composeInstanceStatus(dbConnErr(), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('connection_error');
    });

    it('maps configured:false + no_tables, exposes missing array and length', () => {
      const s = composeInstanceStatus(dbNoTables(['action_records', 'guard_decisions']), authNone());
      expect(s.db.ok).toBe(false);
      expect(s.db.reason).toBe('no_tables');
      expect(s.db.missing).toEqual(['action_records', 'guard_decisions']);
      expect(s.db.missing.length).toBe(2);
    });

    it('maps configured:true to db.ok:true', () => {
      const s = composeInstanceStatus(dbOk(), authNone());
      expect(s.db.ok).toBe(true);
    });
  });

  describe('auth state', () => {
    it('no methods → auth.ok:false, auth.methods:[]', () => {
      const s = composeInstanceStatus(dbOk(), authNone());
      expect(s.auth.ok).toBe(false);
      expect(s.auth.methods).toEqual([]);
    });

    it('GitHub only → auth.ok:true, auth.methods:["GitHub"]', () => {
      const s = composeInstanceStatus(dbOk(), authGitHub());
      expect(s.auth.ok).toBe(true);
      expect(s.auth.methods).toEqual(['GitHub']);
    });

    it('local password only → auth.ok:true, auth.methods:["Local password"]', () => {
      const s = composeInstanceStatus(dbOk(), authLocalPassword());
      expect(s.auth.ok).toBe(true);
      expect(s.auth.methods).toEqual(['Local password']);
    });

    it('custom OIDC display name → auth.methods uses that name', () => {
      const s = composeInstanceStatus(dbOk(), authOIDCCustomName());
      expect(s.auth.methods).toContain('Authentik');
    });

    it('GitHub + local password → both appear in auth.methods', () => {
      const s = composeInstanceStatus(dbOk(), authGitHubAndLocal());
      expect(s.auth.methods).toContain('GitHub');
      expect(s.auth.methods).toContain('Local password');
    });
  });

  describe('overall', () => {
    it('missing_database_url → not_configured', () => {
      expect(composeInstanceStatus(dbNoUrl(), authNone()).overall).toBe('not_configured');
    });

    it('connection_error → not_configured', () => {
      expect(composeInstanceStatus(dbConnErr(), authNone()).overall).toBe('not_configured');
    });

    it('no_tables → not_configured', () => {
      expect(composeInstanceStatus(dbNoTables(), authNone()).overall).toBe('not_configured');
    });

    it('db ready + no auth → partial', () => {
      expect(composeInstanceStatus(dbOk(), authNone()).overall).toBe('partial');
    });

    it('db ready + auth configured → ready', () => {
      expect(composeInstanceStatus(dbOk(), authGitHub()).overall).toBe('ready');
    });
  });
});
