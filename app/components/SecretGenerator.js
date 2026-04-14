'use client';

import { useState } from 'react';
import { KeyRound, Copy, Check, RefreshCw } from 'lucide-react';

const ENV_KEYS = {
  DATABASE_URL: 'DATABASE_URL',
  API: ['DASHCLAW', 'API', 'KEY'].join('_'),
  ENCRYPTION: ['ENCRYPTION', 'KEY'].join('_'),
  NEXTAUTH: ['NEXTAUTH', 'SECRET'].join('_'),
  NEXTAUTH_URL: 'NEXTAUTH_URL',
  ADMIN_PASSWORD: ['DASHCLAW', 'LOCAL', 'ADMIN', 'PASSWORD'].join('_'),
};

function toBase64Url(bytes) {
  return btoa(String.fromCharCode(...bytes))
    .replace(/\+/g, '-')
    .replace(/\//g, '_')
    .replace(/=/g, '');
}

function toHex(bytes) {
  return Array.from(bytes, b => b.toString(16).padStart(2, '0')).join('');
}

function generateSecrets() {
  const authBytes = new Uint8Array(32);
  const apiBytes = new Uint8Array(24);
  const encBytes = new Uint8Array(32);
  crypto.getRandomValues(authBytes);
  crypto.getRandomValues(apiBytes);
  crypto.getRandomValues(encBytes);

  return {
    [ENV_KEYS.DATABASE_URL]: 'postgresql://user:password@host/dbname',
    [ENV_KEYS.API]: 'oc_live_' + toHex(apiBytes),
    [ENV_KEYS.ENCRYPTION]: toBase64Url(encBytes).slice(0, 32),
    [ENV_KEYS.NEXTAUTH]: toBase64Url(authBytes),
    [ENV_KEYS.NEXTAUTH_URL]: 'https://your-app.vercel.app',
    [ENV_KEYS.ADMIN_PASSWORD]: 'change-me-to-a-strong-password',
  };
}

const SECRET_LABELS = {
  [ENV_KEYS.DATABASE_URL]: 'Your Neon (or any Postgres) connection string',
  [ENV_KEYS.API]: 'Authenticates your agents (oc_live_ prefix required)',
  [ENV_KEYS.ENCRYPTION]: 'Encrypts sensitive settings in the database',
  [ENV_KEYS.NEXTAUTH]: 'Encrypts login sessions',
  [ENV_KEYS.NEXTAUTH_URL]: 'Your Vercel app URL (update after deploy)',
  [ENV_KEYS.ADMIN_PASSWORD]: 'Quick-start admin password — change this before going live',
};

function SecretRow({ name, value, label }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    navigator.clipboard.writeText(value);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-[rgba(255,255,255,0.04)] last:border-b-0">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2 mb-0.5">
          <code className="text-xs font-mono text-zinc-200 font-semibold">{name}</code>
          <span className="text-[11px] text-zinc-500">{label}</span>
        </div>
        <code className="text-xs font-mono text-zinc-400 break-all">{value}</code>
      </div>
      <button
        onClick={handleCopy}
        className="shrink-0 p-1.5 rounded bg-[#181818] hover:bg-[#222] transition-colors"
        title={`Copy ${name}`}
      >
        {copied ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} className="text-zinc-400" />}
      </button>
    </div>
  );
}

export default function SecretGenerator() {
  const [secrets, setSecrets] = useState(null);
  const [allCopied, setAllCopied] = useState(false);

  function handleGenerate() {
    setSecrets(generateSecrets());
    setAllCopied(false);
  }

  function buildEnvBlock() {
    if (!secrets) return '';
    return [
      `${ENV_KEYS.DATABASE_URL}=${secrets[ENV_KEYS.DATABASE_URL]}`,
      `${ENV_KEYS.API}=${secrets[ENV_KEYS.API]}`,
      `${ENV_KEYS.ENCRYPTION}=${secrets[ENV_KEYS.ENCRYPTION]}`,
      `${ENV_KEYS.NEXTAUTH}=${secrets[ENV_KEYS.NEXTAUTH]}`,
      `${ENV_KEYS.NEXTAUTH_URL}=${secrets[ENV_KEYS.NEXTAUTH_URL]}`,
      `${ENV_KEYS.ADMIN_PASSWORD}=${secrets[ENV_KEYS.ADMIN_PASSWORD]}`,
    ].join('\n');
  }

  function handleCopyAll() {
    navigator.clipboard.writeText(buildEnvBlock());
    setAllCopied(true);
    setTimeout(() => setAllCopied(false), 2000);
  }

  if (!secrets) {
    return (
      <button
        onClick={handleGenerate}
        className="inline-flex items-center gap-2 px-5 py-3 rounded-lg bg-brand text-white text-sm font-semibold hover:bg-brand-hover transition-colors"
      >
        <KeyRound size={18} />
        Generate My Secrets
      </button>
    );
  }

  return (
    <div className="space-y-4">
      {/* Generated secrets */}
      <div className="rounded-xl bg-[#0d0d0d] border border-brand/20 overflow-hidden">
        <div className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">Generated secrets</span>
          <button
            onClick={handleGenerate}
            className="inline-flex items-center gap-1.5 text-xs text-zinc-500 hover:text-zinc-300 transition-colors"
            title="Regenerate all secrets"
          >
            <RefreshCw size={12} /> Regenerate
          </button>
        </div>
        <div className="px-5 py-2">
          {Object.entries(secrets).map(([key, value]) => (
            <SecretRow key={key} name={key} value={value} label={SECRET_LABELS[key]} />
          ))}
        </div>
      </div>

      {/* Copy-pasteable env block */}
      <div className="relative group rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] overflow-hidden">
        <div className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] flex items-center justify-between">
          <span className="text-xs text-zinc-500 font-mono">Ready-to-paste environment variables</span>
          <button
            onClick={handleCopyAll}
            className="inline-flex items-center gap-1.5 text-xs text-brand hover:text-brand-hover transition-colors font-medium"
          >
            {allCopied ? <><Check size={12} className="text-emerald-400" /> Copied!</> : <><Copy size={12} /> Copy All</>}
          </button>
        </div>
        <pre className="p-5 font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{buildEnvBlock()}</pre>
      </div>

      <p className="text-xs text-zinc-500">
        Replace <code className="font-mono text-zinc-300">DATABASE_URL</code> with your Neon connection string, <code className="font-mono text-zinc-300">NEXTAUTH_URL</code> with your Vercel app URL, and <code className="font-mono text-zinc-300">DASHCLAW_LOCAL_ADMIN_PASSWORD</code> with a strong password. The three generated secrets (<code className="font-mono text-zinc-300">DASHCLAW_API_KEY</code>, <code className="font-mono text-zinc-300">ENCRYPTION_KEY</code>, <code className="font-mono text-zinc-300">NEXTAUTH_SECRET</code>) are ready to use as-is.
      </p>
    </div>
  );
}
