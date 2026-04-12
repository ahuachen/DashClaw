// app/lib/doctor/fixes/env-writer.mjs
import { readFileSync, writeFileSync, copyFileSync, existsSync } from 'node:fs';
import { resolve } from 'node:path';

const ENV_PATH = resolve(process.cwd(), '.env');
const BACKUP_PATH = resolve(process.cwd(), '.env.backup');

/**
 * Parse .env into a key-value object.
 * @param {string} text
 */
export function parseEnv(text) {
  const env = {};
  for (const line of text.split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const idx = trimmed.indexOf('=');
    if (idx === -1) continue;
    const key = trimmed.slice(0, idx).trim();
    let value = trimmed.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

/**
 * Read current .env file. Returns empty object if missing.
 */
export function readEnvFile() {
  if (!existsSync(ENV_PATH)) return {};
  return parseEnv(readFileSync(ENV_PATH, 'utf8'));
}

/**
 * Back up .env, then write updated values.
 * Only adds or updates keys — never removes existing ones.
 * @param {Record<string, string>} updates
 */
export function writeEnvUpdates(updates) {
  const backedUp = existsSync(ENV_PATH);
  if (backedUp) copyFileSync(ENV_PATH, BACKUP_PATH);

  const current = readEnvFile();
  const merged = { ...current, ...updates };

  const lines = Object.entries(merged).map(([k, v]) => {
    const needsQuotes = v.includes(' ') || v.includes('#') || v.includes("'");
    return `${k}=${needsQuotes ? `"${v}"` : v}`;
  });

  writeFileSync(ENV_PATH, lines.join('\n') + '\n', 'utf8');

  return { backedUp, keysWritten: Object.keys(updates) };
}
