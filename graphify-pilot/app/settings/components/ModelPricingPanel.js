'use client';

import { useState, useEffect, useCallback } from 'react';

const DEFAULT_PRICING = [
  // Anthropic Claude 4.5/4.6 family
  { pattern: 'opus-4-6', label: 'Claude Opus 4.6', input: 15, output: 75 },
  { pattern: 'opus-4-5', label: 'Claude Opus 4.5', input: 15, output: 75 },
  { pattern: 'opus', label: 'Claude Opus (default)', input: 15, output: 75 },
  { pattern: 'sonnet-4-6', label: 'Claude Sonnet 4.6', input: 3, output: 15 },
  { pattern: 'sonnet-4-5', label: 'Claude Sonnet 4.5', input: 3, output: 15 },
  { pattern: 'sonnet', label: 'Claude Sonnet (default)', input: 3, output: 15 },
  { pattern: 'haiku-4-5', label: 'Claude Haiku 4.5', input: 0.80, output: 4 },
  { pattern: 'haiku', label: 'Claude Haiku (default)', input: 0.80, output: 4 },
  // OpenAI
  { pattern: 'codex-5.4', label: 'Codex 5.4', input: 3, output: 15 },
  { pattern: 'codex', label: 'Codex (default)', input: 3, output: 15 },
  { pattern: 'o3-pro', label: 'o3-pro', input: 150, output: 600 },
  { pattern: 'o3-mini', label: 'o3-mini', input: 1.10, output: 4.40 },
  { pattern: 'o3', label: 'o3', input: 10, output: 40 },
  { pattern: 'o4-mini', label: 'o4-mini', input: 1.10, output: 4.40 },
  { pattern: 'gpt-4.1-mini', label: 'GPT-4.1 Mini', input: 0.40, output: 1.60 },
  { pattern: 'gpt-4.1-nano', label: 'GPT-4.1 Nano', input: 0.10, output: 0.40 },
  { pattern: 'gpt-4.1', label: 'GPT-4.1', input: 2, output: 8 },
  { pattern: 'gpt-4o-mini', label: 'GPT-4o Mini', input: 0.15, output: 0.60 },
  { pattern: 'gpt-4o', label: 'GPT-4o', input: 2.50, output: 10 },
  // Google Gemini
  { pattern: 'gemini-2.5-pro', label: 'Gemini 2.5 Pro', input: 1.25, output: 10 },
  { pattern: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', input: 0.15, output: 0.60 },
  // Meta Llama
  { pattern: 'llama-4-maverick', label: 'Llama 4 Maverick', input: 0.50, output: 0.77 },
  { pattern: 'llama-4-scout', label: 'Llama 4 Scout', input: 0.17, output: 0.35 },
];

export default function ModelPricingPanel() {
  const [pricing, setPricing] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [editingIdx, setEditingIdx] = useState(null);
  const [editRow, setEditRow] = useState({ pattern: '', label: '', input: '', output: '' });
  const [newRow, setNewRow] = useState({ pattern: '', label: '', input: '', output: '' });

  const loadPricing = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/settings?key=MODEL_PRICING');
      const data = await res.json();
      const setting = data.settings?.find(s => s.key === 'MODEL_PRICING');
      if (setting?.value) {
        try {
          const parsed = JSON.parse(setting.value);
          if (Array.isArray(parsed) && parsed.length > 0) {
            setPricing(parsed);
            setLoading(false);
            return;
          }
        } catch {
          // Invalid JSON in stored value, fall through to defaults
        }
      }
      setPricing(DEFAULT_PRICING.map(p => ({ ...p })));
    } catch {
      setPricing(DEFAULT_PRICING.map(p => ({ ...p })));
    }
    setLoading(false);
  }, []);

  useEffect(() => { loadPricing(); }, [loadPricing]);

  const savePricing = useCallback(async () => {
    if (!pricing) return;
    setSaving(true);
    setStatus(null);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          key: 'MODEL_PRICING',
          value: JSON.stringify(pricing),
          category: 'system',
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        setStatus({ type: 'success', message: 'Pricing saved successfully.' });
      } else {
        setStatus({ type: 'error', message: data.error || 'Failed to save pricing.' });
      }
    } catch {
      setStatus({ type: 'error', message: 'Network error. Could not save.' });
    }
    setSaving(false);
  }, [pricing]);

  const resetToDefaults = useCallback(() => {
    setPricing(DEFAULT_PRICING.map(p => ({ ...p })));
    setEditingIdx(null);
    setStatus({ type: 'success', message: 'Reset to default pricing. Click Save to persist.' });
  }, []);

  const startEdit = (idx) => {
    setEditingIdx(idx);
    setEditRow({ ...pricing[idx] });
  };

  const cancelEdit = () => {
    setEditingIdx(null);
    setEditRow({ pattern: '', label: '', input: '', output: '' });
  };

  const confirmEdit = () => {
    if (!editRow.pattern || editRow.input === '' || editRow.output === '') return;
    const updated = [...pricing];
    updated[editingIdx] = {
      pattern: editRow.pattern.trim(),
      label: editRow.label.trim() || editRow.pattern.trim(),
      input: parseFloat(editRow.input) || 0,
      output: parseFloat(editRow.output) || 0,
    };
    setPricing(updated);
    setEditingIdx(null);
    setEditRow({ pattern: '', label: '', input: '', output: '' });
  };

  const deleteRow = (idx) => {
    setPricing(pricing.filter((_, i) => i !== idx));
    if (editingIdx === idx) cancelEdit();
  };

  const addRow = () => {
    if (!newRow.pattern || newRow.input === '' || newRow.output === '') return;
    setPricing([
      ...pricing,
      {
        pattern: newRow.pattern.trim(),
        label: newRow.label.trim() || newRow.pattern.trim(),
        input: parseFloat(newRow.input) || 0,
        output: parseFloat(newRow.output) || 0,
      },
    ]);
    setNewRow({ pattern: '', label: '', input: '', output: '' });
  };

  if (loading) {
    return (
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-8">
        <p className="text-sm text-zinc-500">Loading pricing configuration...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 max-w-4xl">
      {/* Header */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-6">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-white">Model Pricing</h3>
            <p className="mt-1 text-xs text-zinc-500">
              Configure per-model token pricing used for cost estimation when agents report actions.
              Prices are in USD per million tokens. The pattern field is matched against the model name reported by agents.
            </p>
          </div>
          <div className="flex gap-2">
            <button
              onClick={resetToDefaults}
              className="px-3 py-1.5 text-xs font-medium rounded-lg border border-white/10 text-zinc-400 hover:text-white hover:border-white/20 transition-colors"
            >
              Reset to Defaults
            </button>
            <button
              onClick={savePricing}
              disabled={saving}
              className="px-4 py-1.5 text-xs font-medium rounded-lg bg-brand/10 border border-brand/30 text-brand hover:bg-brand/20 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {saving ? 'Saving...' : 'Save Pricing'}
            </button>
          </div>
        </div>

        {status && (
          <div className={`mt-4 px-4 py-2 rounded-lg text-xs ${
            status.type === 'success'
              ? 'bg-emerald-950/30 border border-emerald-900/40 text-emerald-300'
              : 'bg-red-950/30 border border-red-900/40 text-red-300'
          }`}>
            {status.message}
          </div>
        )}
      </div>

      {/* Pricing table */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] overflow-hidden">
        <table className="w-full">
          <thead>
            <tr className="border-b border-white/5">
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Pattern</th>
              <th className="px-5 py-3 text-left text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Label</th>
              <th className="px-5 py-3 text-right text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Input $/M</th>
              <th className="px-5 py-3 text-right text-[10px] uppercase tracking-widest text-zinc-600 font-medium">Output $/M</th>
              <th className="px-5 py-3 text-right text-[10px] uppercase tracking-widest text-zinc-600 font-medium w-24">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-white/[0.04]">
            {pricing.map((row, idx) => (
              <tr key={`${row.pattern}-${idx}`} className="group hover:bg-white/[0.02]">
                {editingIdx === idx ? (
                  <>
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={editRow.pattern}
                        onChange={(e) => setEditRow({ ...editRow, pattern: e.target.value })}
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs font-mono text-zinc-200 focus:border-brand/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="text"
                        value={editRow.label}
                        onChange={(e) => setEditRow({ ...editRow, label: e.target.value })}
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200 focus:border-brand/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editRow.input}
                        onChange={(e) => setEditRow({ ...editRow, input: e.target.value })}
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-right font-mono text-zinc-200 focus:border-brand/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-2">
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editRow.output}
                        onChange={(e) => setEditRow({ ...editRow, output: e.target.value })}
                        className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-right font-mono text-zinc-200 focus:border-brand/50 focus:outline-none"
                      />
                    </td>
                    <td className="px-5 py-2 text-right">
                      <button onClick={confirmEdit} className="text-xs text-emerald-400 hover:text-emerald-300 mr-2">Save</button>
                      <button onClick={cancelEdit} className="text-xs text-zinc-500 hover:text-zinc-300">Cancel</button>
                    </td>
                  </>
                ) : (
                  <>
                    <td className="px-5 py-3 text-xs font-mono text-zinc-300">{row.pattern}</td>
                    <td className="px-5 py-3 text-xs text-zinc-400">{row.label}</td>
                    <td className="px-5 py-3 text-xs text-right font-mono text-zinc-300">${row.input.toFixed(2)}</td>
                    <td className="px-5 py-3 text-xs text-right font-mono text-zinc-300">${row.output.toFixed(2)}</td>
                    <td className="px-5 py-3 text-right">
                      <button onClick={() => startEdit(idx)} className="text-xs text-zinc-600 hover:text-zinc-300 mr-2 opacity-0 group-hover:opacity-100 transition-opacity">Edit</button>
                      <button onClick={() => deleteRow(idx)} className="text-xs text-zinc-600 hover:text-red-400 opacity-0 group-hover:opacity-100 transition-opacity">Delete</button>
                    </td>
                  </>
                )}
              </tr>
            ))}

            {/* Add new row */}
            <tr className="bg-white/[0.01]">
              <td className="px-5 py-2">
                <input
                  type="text"
                  placeholder="e.g. deepseek"
                  value={newRow.pattern}
                  onChange={(e) => setNewRow({ ...newRow, pattern: e.target.value })}
                  className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs font-mono text-zinc-200 placeholder:text-zinc-700 focus:border-brand/50 focus:outline-none"
                />
              </td>
              <td className="px-5 py-2">
                <input
                  type="text"
                  placeholder="Display name"
                  value={newRow.label}
                  onChange={(e) => setNewRow({ ...newRow, label: e.target.value })}
                  className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-zinc-200 placeholder:text-zinc-700 focus:border-brand/50 focus:outline-none"
                />
              </td>
              <td className="px-5 py-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newRow.input}
                  onChange={(e) => setNewRow({ ...newRow, input: e.target.value })}
                  className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-right font-mono text-zinc-200 placeholder:text-zinc-700 focus:border-brand/50 focus:outline-none"
                />
              </td>
              <td className="px-5 py-2">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={newRow.output}
                  onChange={(e) => setNewRow({ ...newRow, output: e.target.value })}
                  className="w-full rounded border border-white/10 bg-black/40 px-2 py-1 text-xs text-right font-mono text-zinc-200 placeholder:text-zinc-700 focus:border-brand/50 focus:outline-none"
                />
              </td>
              <td className="px-5 py-2 text-right">
                <button
                  onClick={addRow}
                  disabled={!newRow.pattern || newRow.input === '' || newRow.output === ''}
                  className="text-xs text-brand hover:text-brand/80 disabled:text-zinc-700 disabled:cursor-not-allowed transition-colors"
                >
                  + Add
                </button>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* Info panel */}
      <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
        <div className="text-[10px] font-bold text-zinc-600 uppercase tracking-widest mb-3">How pricing works</div>
        <div className="space-y-2 text-xs text-zinc-500">
          <p>
            When an agent reports an action with <code className="text-zinc-400 bg-black/40 px-1 rounded">tokens_in</code> and <code className="text-zinc-400 bg-black/40 px-1 rounded">tokens_out</code> but no explicit cost, DashClaw estimates the cost using these prices.
          </p>
          <p>
            The <strong className="text-zinc-400">pattern</strong> is matched against the model name (case-insensitive substring match). Patterns are evaluated top-to-bottom; the first match wins.
          </p>
          <p>
            If no pattern matches, the first entry is used as fallback pricing.
          </p>
        </div>
      </div>
    </div>
  );
}
