'use client';

import { useState, useCallback } from 'react';

const NODE_SNIPPET = `npm install dashclaw

import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: '<YOUR_API_KEY>',
  agentId: 'my-agent',
});

const { action_id } = await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
});`;

const PYTHON_SNIPPET = `pip install dashclaw

from dashclaw import DashClaw

claw = DashClaw(
    base_url="<YOUR_BASE_URL>",
    api_key="<YOUR_API_KEY>",
    agent_id="my-agent",
)

claw.create_action(
    action_type="test",
    declared_goal="Verify DashClaw connection",
)`;

function getCurlSnippet(host) {
  return `curl -X POST ${host}/api/actions \\
  -H "Content-Type: application/json" \\
  -H "x-api-key: <YOUR_API_KEY>" \\
  -d '{"action_type":"test","declared_goal":"Verify DashClaw connection"}'`;
}

export function ConnectNextStepPanel({ maskedApiKey, host, isAuthenticated, overallState }) {
  const [apiKey, setApiKey] = useState(maskedApiKey || '');
  const [status, setStatus] = useState('idle'); // idle | loading | success | error
  const [result, setResult] = useState(null);

  const runTest = useCallback(async () => {
    setStatus('loading');
    setResult(null);
    try {
      const res = await fetch('/api/setup/ping', {
        method: 'POST',
        headers: { 'x-api-key': apiKey },
      });
      const data = await res.json();
      if (data.ok) {
        // Redirect with proof token so the page reloads as "verified"
        if (data.proof_token) {
          window.location.href = `/setup?proof=${encodeURIComponent(data.proof_token)}`;
          return;
        }
        setStatus('success');
        setResult(data);
      } else {
        setStatus('error');
        setResult(data);
      }
    } catch {
      setStatus('error');
      setResult({ message: 'Network error. Could not reach the instance.' });
    }
  }, [apiKey]);

  const showSnippets =
    (overallState === 'ready_unverified' || overallState === 'verified') &&
    (status === 'idle' || status === 'success');

  return (
    <div className="mt-6 space-y-4">
      {/* Test connection card */}
      <div
        className={`rounded-2xl border p-6 ${
          status === 'success'
            ? 'border-emerald-900/40 bg-emerald-950/20'
            : 'border-[rgba(255,255,255,0.08)] bg-[#111]'
        }`}
      >
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Test your connection</p>

        {status === 'success' ? (
          <div className="mt-4">
            <p className="text-sm font-medium text-emerald-300">
              Connected. Your instance is accepting authenticated requests.
            </p>
            {result?.latencyMs != null && (
              <p className="mt-1 text-xs text-zinc-500">Latency: {result.latencyMs}ms</p>
            )}
            <button
              type="button"
              onClick={() => { setStatus('idle'); setResult(null); }}
              className="mt-3 text-xs text-zinc-500 underline hover:text-zinc-300"
            >
              Run again
            </button>
          </div>
        ) : (
          <div className="mt-4">
            <label htmlFor="setup-api-key" className="block text-xs font-medium text-zinc-400">
              API Key
            </label>
            <input
              id="setup-api-key"
              type="text"
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              placeholder="Paste your API key"
              className="mt-1 w-full rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#0a0a0a] px-3 py-2 text-sm font-mono text-zinc-200 placeholder:text-zinc-600 focus:border-brand/50 focus:outline-none focus:ring-1 focus:ring-brand/30"
            />
            {status === 'error' && result?.message && (
              <p className="mt-2 text-xs text-amber-400">{result.message}</p>
            )}
            <button
              type="button"
              onClick={runTest}
              disabled={status === 'loading' || !apiKey}
              className="mt-3 inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/60 hover:bg-brand/15 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {status === 'loading' ? 'Testing\u2026' : 'Run test'}
            </button>
          </div>
        )}
      </div>

      {/* SDK snippet cards */}
      {showSnippets && (
        <div className="grid gap-4 lg:grid-cols-3">
          <SnippetCard label="Node" code={NODE_SNIPPET} />
          <SnippetCard label="Python" code={PYTHON_SNIPPET} />
          <SnippetCard label="cURL" code={getCurlSnippet(host)} />
        </div>
      )}
    </div>
  );
}

function SnippetCard({ label, code }) {
  const [copied, setCopied] = useState(false);

  const copy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(code);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch { /* clipboard unavailable */ }
  }, [code]);

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#0d0d0d] p-4">
      <div className="flex items-center justify-between">
        <p className="text-xs uppercase tracking-[0.24em] text-zinc-500">{label}</p>
        <button
          type="button"
          onClick={copy}
          className="text-zinc-500 hover:text-zinc-300 transition-colors"
          aria-label={`Copy ${label} snippet`}
        >
          {copied ? (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="20 6 9 17 4 12" /></svg>
          ) : (
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect x="9" y="9" width="13" height="13" rx="2" /><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1" /></svg>
          )}
        </button>
      </div>
      <pre className="mt-3 overflow-x-auto whitespace-pre-wrap rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#050505] px-4 py-3 text-xs font-mono text-zinc-300">
        {code}
      </pre>
    </div>
  );
}
