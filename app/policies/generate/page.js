'use client';

import { useState } from 'react';

export default function PolicyGeneratePage() {
  const [inputText, setInputText] = useState('');
  const [preview, setPreview] = useState(null);
  const [warnings, setWarnings] = useState([]);
  const [loading, setLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPolicies, setSelectedPolicies] = useState(new Set());

  async function handleGenerate() {
    setLoading(true);
    setError(null);
    setPreview(null);
    setWarnings([]);
    setSuccess(null);

    try {
      const res = await fetch('/api/policies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_text: inputText, dry_run: true }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate policies');
        return;
      }

      if (data.generated_policies.length === 0) {
        setError('No policies could be generated. Try rephrasing your input.');
        return;
      }

      setPreview(data);
      setSelectedPolicies(new Set(data.generated_policies.map((_, i) => i)));
      setWarnings(data.warnings || []);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleCreate() {
    if (!preview) return;
    setCreating(true);
    setError(null);

    try {
      const res = await fetch('/api/policies/generate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ input_text: inputText, dry_run: false }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to create policies');
        return;
      }

      setSuccess(`Created ${data.count} ${data.count === 1 ? 'policy' : 'policies'}`);
      setPreview(null);
      setInputText('');
    } catch (err) {
      setError(err.message);
    } finally {
      setCreating(false);
    }
  }

  function togglePolicy(index) {
    setSelectedPolicies((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  }

  const confidenceColor = (c) => {
    if (c >= 0.9) return 'text-green-400';
    if (c >= 0.7) return 'text-yellow-400';
    return 'text-red-400';
  };

  return (
    <div className="max-w-4xl mx-auto p-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-white mb-2">AI Policy Generator</h1>
        <p className="text-zinc-400">
          Paste your company policy, compliance requirement, or Slack message and DashClaw will generate enforceable guard rules.
        </p>
      </div>

      {success && (
        <div className="mb-4 p-3 rounded bg-green-900/30 border border-green-700 text-green-300">
          {success}{' '}
          <a href="/policies" className="underline text-green-200 hover:text-white">
            View policies
          </a>
        </div>
      )}

      {error && (
        <div className="mb-4 p-3 rounded bg-red-900/30 border border-red-700 text-red-300">
          {error}
        </div>
      )}

      <div className="mb-4">
        <textarea
          value={inputText}
          onChange={(e) => setInputText(e.target.value)}
          placeholder="Paste your company policy, Slack message, or compliance requirement..."
          rows={6}
          maxLength={5000}
          className="w-full p-3 rounded bg-zinc-800 border border-zinc-700 text-white placeholder-zinc-500 focus:border-orange-500 focus:ring-1 focus:ring-orange-500 outline-none resize-y"
        />
        <div className="text-xs text-zinc-500 mt-1 text-right">
          {inputText.length}/5000
        </div>
      </div>

      <button
        onClick={handleGenerate}
        disabled={loading || !inputText.trim()}
        className="px-4 py-2 rounded bg-orange-600 hover:bg-orange-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? 'Generating...' : 'Generate Preview'}
      </button>

      {preview && (
        <div className="mt-6 space-y-4">
          <h2 className="text-lg font-semibold text-white">
            Generated {preview.generated_policies.length}{' '}
            {preview.generated_policies.length === 1 ? 'policy' : 'policies'}
          </h2>

          {preview.generated_policies.map((policy, i) => (
            <div
              key={i}
              className={`p-4 rounded border ${
                selectedPolicies.has(i)
                  ? 'border-orange-600 bg-zinc-800'
                  : 'border-zinc-700 bg-zinc-900 opacity-60'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-3">
                  <input
                    type="checkbox"
                    checked={selectedPolicies.has(i)}
                    onChange={() => togglePolicy(i)}
                    className="accent-orange-500"
                  />
                  <span className="font-medium text-white">{policy.name}</span>
                </div>
                {policy.confidence != null && (
                  <span className={`text-sm font-mono ${confidenceColor(policy.confidence)}`}>
                    {(policy.confidence * 100).toFixed(0)}% confidence
                  </span>
                )}
              </div>
              <div className="text-sm text-zinc-400 mb-2">
                Type: <span className="text-zinc-300">{policy.policy_type}</span>
              </div>
              <pre className="text-xs bg-zinc-900 p-2 rounded text-zinc-300 overflow-x-auto">
                {JSON.stringify(policy.rules, null, 2)}
              </pre>
              {policy.recovery_recipe && (
                <div className="mt-2 text-sm text-zinc-400">
                  Recovery: <span className="text-zinc-300">{policy.recovery_recipe.suggestion}</span>
                </div>
              )}
            </div>
          ))}

          {warnings.length > 0 && (
            <details className="text-sm">
              <summary className="text-yellow-400 cursor-pointer">
                {warnings.length} {warnings.length === 1 ? 'warning' : 'warnings'}
              </summary>
              <ul className="mt-2 space-y-1 text-zinc-400">
                {warnings.map((w, i) => (
                  <li key={i}>- {w}</li>
                ))}
              </ul>
            </details>
          )}

          <button
            onClick={handleCreate}
            disabled={creating || selectedPolicies.size === 0}
            className="px-4 py-2 rounded bg-green-600 hover:bg-green-500 text-white font-medium disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {creating
              ? 'Creating...'
              : `Create ${selectedPolicies.size} ${selectedPolicies.size === 1 ? 'Policy' : 'Policies'}`}
          </button>
        </div>
      )}
    </div>
  );
}
