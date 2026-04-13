// app/lib/doctor/checks/openclawPlugin.mjs
//
// Doctor check for OpenClaw gateway plugin configuration. Catches the most
// common DashClaw-governance plugin config mistakes at install time instead of
// waiting for an error in the gateway log.
//
// The check is path-driven and non-invasive:
//   - Pass: no config file found (this DashClaw host doesn't colocate OpenClaw)
//   - Pass: config is valid (URL + API key resolve from config or env)
//   - Warn: config has wrong-case keys, legacy shapes, or unresolved ${ENV} refs
//   - Fail: plugin is enabled but required config is missing
//
// Discovers `openclaw.plugin.json` in:
//   1. $DASHCLAW_OPENCLAW_CONFIG  (explicit override)
//   2. ./openclaw.plugin.json     (cwd)
//   3. ../openclaw.plugin.json    (parent)

import { existsSync, readFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

const CANONICAL_URL_KEYS = ['dashclawUrl', 'baseUrl'];
const CANONICAL_KEY_KEYS = ['dashclawApiKey', 'apiKey'];
const URL_ENV_VARS = ['DASHCLAW_BASE_URL', 'DASHCLAW_URL'];
const KEY_ENV_VARS = ['DASHCLAW_API_KEY'];

// Common mistakes we want to call out explicitly so users don't guess.
const COMMON_TYPOS = {
  dashclaw_url: 'dashclawUrl',
  dashclawURL: 'dashclawUrl',
  DashclawUrl: 'dashclawUrl',
  DASHCLAWURL: 'dashclawUrl',
  'dashclaw-url': 'dashclawUrl',
  dashclawkey: 'dashclawApiKey',
  dashclaw_api_key: 'dashclawApiKey',
  dashclawAPIKey: 'dashclawApiKey',
  'dashclaw-api-key': 'dashclawApiKey',
  apikey: 'apiKey',
  ApiKey: 'apiKey',
};

function findConfigPath(env) {
  const candidates = [
    env.DASHCLAW_OPENCLAW_CONFIG,
    join(process.cwd(), 'openclaw.plugin.json'),
    resolve(process.cwd(), '..', 'openclaw.plugin.json'),
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (existsSync(candidate)) return candidate;
  }
  return null;
}

function readJson(path) {
  try {
    return JSON.parse(readFileSync(path, 'utf8'));
  } catch (err) {
    return { __parseError: err.message };
  }
}

function findPluginEntry(doc) {
  // Shape 1: full OpenClaw config with { plugins: { entries: { "dashclaw-governance": {...} } } }
  if (doc?.plugins?.entries?.['dashclaw-governance']) {
    return doc.plugins.entries['dashclaw-governance'];
  }
  // Shape 2: bare plugin manifest (id === "dashclaw-governance")
  if (doc?.id === 'dashclaw-governance') return doc;
  return null;
}

function isUnresolvedEnvRef(value) {
  return typeof value === 'string' && /^\$\{[A-Z0-9_]+\}$/.test(value);
}

function hasResolvableUrl(config, env) {
  for (const key of CANONICAL_URL_KEYS) {
    if (typeof config?.[key] === 'string' && config[key] && !isUnresolvedEnvRef(config[key])) {
      return { source: `config.${key}` };
    }
  }
  for (const v of URL_ENV_VARS) {
    if (env[v]) return { source: `env.${v}` };
  }
  return null;
}

function hasResolvableKey(config, env) {
  for (const key of CANONICAL_KEY_KEYS) {
    if (typeof config?.[key] === 'string' && config[key] && !isUnresolvedEnvRef(config[key])) {
      return { source: `config.${key}` };
    }
  }
  for (const v of KEY_ENV_VARS) {
    if (env[v]) return { source: `env.${v}` };
  }
  return null;
}

function findTypos(config) {
  const hits = [];
  if (!config || typeof config !== 'object') return hits;
  for (const [k, v] of Object.entries(config)) {
    if (COMMON_TYPOS[k]) {
      hits.push({ typo: k, correct: COMMON_TYPOS[k], preview: typeof v === 'string' ? `${v.slice(0, 12)}…` : '' });
    }
  }
  return hits;
}

function findUnresolvedEnvRefs(config) {
  const hits = [];
  if (!config || typeof config !== 'object') return hits;
  for (const [k, v] of Object.entries(config)) {
    if (isUnresolvedEnvRef(v)) hits.push({ key: k, value: v });
  }
  return hits;
}

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const path = findConfigPath(env);
  const checks = [];

  if (!path) {
    checks.push({
      id: 'openclaw_plugin_config_present',
      category: 'openclaw-plugin',
      status: 'pass',
      title: 'OpenClaw plugin config',
      message:
        'No openclaw.plugin.json found on this host — skipping OpenClaw-plugin checks. Set DASHCLAW_OPENCLAW_CONFIG to explicitly point at one.',
      fix: null,
    });
    return checks;
  }

  const doc = readJson(path);
  if (doc.__parseError) {
    checks.push({
      id: 'openclaw_plugin_parse',
      category: 'openclaw-plugin',
      status: 'fail',
      title: 'OpenClaw config parse',
      message: `${path}: ${doc.__parseError}`,
      fix: null,
    });
    return checks;
  }

  const entry = findPluginEntry(doc);
  if (!entry) {
    checks.push({
      id: 'openclaw_plugin_entry',
      category: 'openclaw-plugin',
      status: 'pass',
      title: 'OpenClaw plugin entry',
      message: `${path}: no dashclaw-governance entry found — plugin is not installed here.`,
      fix: null,
    });
    return checks;
  }

  if (entry.enabled === false) {
    checks.push({
      id: 'openclaw_plugin_enabled',
      category: 'openclaw-plugin',
      status: 'pass',
      title: 'OpenClaw plugin enabled',
      message: `${path}: dashclaw-governance is disabled — skipping further checks.`,
      fix: null,
    });
    return checks;
  }

  const config = entry.config ?? entry;

  // Typo check
  const typos = findTypos(config);
  if (typos.length) {
    checks.push({
      id: 'openclaw_plugin_typos',
      category: 'openclaw-plugin',
      status: 'warn',
      title: 'OpenClaw plugin config — unknown key',
      message: `${path}: ${typos
        .map((t) => `"${t.typo}" should be "${t.correct}"`)
        .join('; ')}. The plugin ignores unknown keys, so the value won't take effect.`,
      fix: null,
    });
  }

  // Unresolved ${ENV} placeholders
  const unresolved = findUnresolvedEnvRefs(config);
  if (unresolved.length) {
    checks.push({
      id: 'openclaw_plugin_unresolved_env',
      category: 'openclaw-plugin',
      status: 'warn',
      title: 'OpenClaw plugin config — unresolved env placeholder',
      message: `${path}: ${unresolved
        .map((u) => `${u.key}=${u.value}`)
        .join('; ')}. The OpenClaw gateway may not substitute ${'${ENV}'} placeholders. If this is the case, set the value literally or rely on the plugin's env-var fallback.`,
      fix: null,
    });
  }

  // Resolvability check — either plugin config OR env vars satisfy the plugin
  const urlResolve = hasResolvableUrl(config, env);
  const keyResolve = hasResolvableKey(config, env);

  const missing = [];
  if (!urlResolve) missing.push('dashclawUrl / baseUrl / DASHCLAW_BASE_URL / DASHCLAW_URL');
  if (!keyResolve) missing.push('dashclawApiKey / apiKey / DASHCLAW_API_KEY');

  if (missing.length) {
    checks.push({
      id: 'openclaw_plugin_missing',
      category: 'openclaw-plugin',
      status: 'fail',
      title: 'OpenClaw plugin config — missing required values',
      message: `${path}: plugin will throw on first tool call. Missing: ${missing.join(' and ')}. Set in plugin config, as env vars, or use SDK-style aliases (baseUrl/apiKey).`,
      fix: null,
    });
  } else {
    checks.push({
      id: 'openclaw_plugin_resolvable',
      category: 'openclaw-plugin',
      status: 'pass',
      title: 'OpenClaw plugin config — URL & API key resolvable',
      message: `URL from ${urlResolve.source}; API key from ${keyResolve.source}.`,
      fix: null,
    });
  }

  return checks;
}
