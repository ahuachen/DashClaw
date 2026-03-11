/**
 * Startup environment variable validation.
 * Import this module early to fail fast on misconfiguration.
 * Only validates in production (NODE_ENV=production).
 */
import { getAuthConfig, getMissingAuthMessage } from './authConfig.mjs';

const isProd = process.env.NODE_ENV === 'production';

const warnings = [];
const errors = [];

// Required in all modes
if (!process.env.DATABASE_URL) {
  warnings.push('DATABASE_URL is not set — using mock database driver');
}

if (isProd) {
  // Required in production
  if (!process.env.DASHCLAW_API_KEY) {
    errors.push('DASHCLAW_API_KEY must be set in production');
  }

  if (!process.env.NEXTAUTH_SECRET) {
    errors.push('NEXTAUTH_SECRET must be set in production');
  }

  if (!process.env.ENCRYPTION_KEY) {
    warnings.push('ENCRYPTION_KEY is not set — sensitive settings cannot be encrypted');
  } else if (process.env.ENCRYPTION_KEY.length !== 32) {
    errors.push('ENCRYPTION_KEY must be exactly 32 characters');
  }

  const authConfig = getAuthConfig();
  if (!authConfig.hasAnySignInMethod) {
    warnings.push(getMissingAuthMessage());
  }

  // Validate OIDC fields if any are set
  if (process.env.OIDC_CLIENT_ID || process.env.OIDC_CLIENT_SECRET || process.env.OIDC_ISSUER_URL) {
    if (!process.env.OIDC_CLIENT_ID) errors.push('OIDC_CLIENT_ID is required when OIDC is partially configured');
    if (!process.env.OIDC_CLIENT_SECRET) errors.push('OIDC_CLIENT_SECRET is required when OIDC is partially configured');
    if (!process.env.OIDC_ISSUER_URL) errors.push('OIDC_ISSUER_URL is required when OIDC is partially configured');
  }

  // Warn if OIDC endpoint overrides are partially set (all three should be set together)
  const oidcEndpointOverrides = [
    process.env.OIDC_AUTHORIZATION_URL,
    process.env.OIDC_TOKEN_URL,
    process.env.OIDC_USERINFO_URL,
  ].filter(Boolean);
  if (oidcEndpointOverrides.length > 0 && oidcEndpointOverrides.length < 3) {
    warnings.push('Only some OIDC endpoint overrides are set. For Authentik, set all three: OIDC_AUTHORIZATION_URL, OIDC_TOKEN_URL, and OIDC_USERINFO_URL');
  }

  // Recommended in production
  if (!process.env.CRON_SECRET) {
    warnings.push('CRON_SECRET is not set — cron endpoints will return 503');
  }

  if (!process.env.ALLOWED_ORIGIN) {
    warnings.push('ALLOWED_ORIGIN is not set — CORS will block cross-origin API requests');
  }
}

// Log warnings
for (const w of warnings) {
  console.warn(`[ENV] WARNING: ${w}`);
}

// Log errors (but do not throw — let the app start and fail at the point of use)
for (const e of errors) {
  console.error(`[ENV] ERROR: ${e}`);
}

export const envValidation = {
  warnings,
  errors,
  isValid: errors.length === 0,
};
