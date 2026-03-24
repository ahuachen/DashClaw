// app/settings/components/AgentIdentityPanel.js
'use client';

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Trash2, ShieldCheck, ShieldOff, Plus, X } from 'lucide-react';

function formatDate(dateStr) {
  if (!dateStr) return 'Unknown';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: 'numeric', minute: '2-digit' });
}

function timeUntil(dateStr) {
  if (!dateStr) return '';
  const ms = new Date(dateStr).getTime() - Date.now();
  if (ms <= 0) return 'Expired';
  const mins = Math.ceil(ms / 60000);
  return `${mins}m remaining`;
}

export default function AgentIdentityPanel({ highlightPairingId }) {
  const [enforcement, setEnforcement] = useState(false);
  const [enforcementLoading, setEnforcementLoading] = useState(true);
  const [pairings, setPairings] = useState([]);
  const [pairingsLoading, setPairingsLoading] = useState(true);
  const [identities, setIdentities] = useState([]);
  const [identitiesLoading, setIdentitiesLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [registerAgentId, setRegisterAgentId] = useState('');
  const [registerPublicKey, setRegisterPublicKey] = useState('');
  const [registering, setRegistering] = useState(false);

  // ── Fetch enforcement setting ──
  const fetchEnforcement = useCallback(async () => {
    try {
      const res = await fetch('/api/settings?key=ENFORCE_AGENT_SIGNATURES');
      const data = await res.json();
      if (res.ok && data.settings?.length > 0) {
        setEnforcement(data.settings[0].value === 'true');
      }
    } catch { /* default false */ }
    finally { setEnforcementLoading(false); }
  }, []);

  const toggleEnforcement = async () => {
    const next = !enforcement;
    setEnforcement(next);
    try {
      const res = await fetch('/api/settings', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key: 'ENFORCE_AGENT_SIGNATURES', value: String(next), category: 'system' }),
      });
      if (!res.ok) {
        setEnforcement(!next);
        const data = await res.json();
        setError(data.error || 'Failed to update enforcement setting');
      }
    } catch {
      setEnforcement(!next);
      setError('Failed to update enforcement setting');
    }
  };

  // ── Fetch pending pairings ──
  const fetchPairings = useCallback(async () => {
    setPairingsLoading(true);
    try {
      const res = await fetch('/api/pairings?status=pending&limit=200');
      const data = await res.json();
      if (res.ok) setPairings(data.pairings || []);
      else setError(data.error || 'Failed to load pairings');
    } catch { setError('Failed to load pairings'); }
    finally { setPairingsLoading(false); }
  }, []);

  const approveOne = async (id, { skipRefresh = false } = {}) => {
    setError(null);
    try {
      const res = await fetch(`/api/pairings/${encodeURIComponent(id)}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || `Failed to approve ${id}`);
        return;
      }
      if (!skipRefresh) {
        await fetchPairings();
        await fetchIdentities();
      }
    } catch { setError(`Failed to approve pairing`); }
  };

  const approveAll = async () => {
    setError(null);
    for (const p of pairings) {
      await approveOne(p.id, { skipRefresh: true });
    }
    await fetchPairings();
    await fetchIdentities();
  };

  // ── Fetch identities ──
  const fetchIdentities = useCallback(async () => {
    setIdentitiesLoading(true);
    try {
      const res = await fetch('/api/identities');
      const data = await res.json();
      if (res.ok) setIdentities(data.identities || []);
      else setError(data.error || 'Failed to load identities');
    } catch { setError('Failed to load identities'); }
    finally { setIdentitiesLoading(false); }
  }, []);

  const revokeIdentity = async (agentId) => {
    setError(null);
    try {
      const res = await fetch(`/api/identities/${encodeURIComponent(agentId)}`, { method: 'DELETE' });
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || 'Failed to revoke identity');
        return;
      }
      await fetchIdentities();
      await fetchPairings();
    } catch { setError('Failed to revoke identity'); }
  };

  const registerIdentity = async () => {
    if (!registerAgentId || !registerPublicKey) return;
    setRegistering(true);
    setError(null);
    try {
      const res = await fetch('/api/identities', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agent_id: registerAgentId, public_key: registerPublicKey }),
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || 'Failed to register identity');
        return;
      }
      setRegisterAgentId('');
      setRegisterPublicKey('');
      setShowRegisterForm(false);
      await fetchIdentities();
    } catch { setError('Failed to register identity'); }
    finally { setRegistering(false); }
  };

  // ── Initial load ──
  useEffect(() => {
    fetchEnforcement();
    fetchPairings();
    fetchIdentities();
  }, [fetchEnforcement, fetchPairings, fetchIdentities]);

  // ── Scroll to highlighted pairing ──
  useEffect(() => {
    if (highlightPairingId && !pairingsLoading) {
      const el = document.getElementById(`pairing-${highlightPairingId}`);
      if (el) {
        el.scrollIntoView({ behavior: 'smooth', block: 'center' });
        el.classList.add('ring-2', 'ring-brand/50');
        setTimeout(() => el.classList.remove('ring-2', 'ring-brand/50'), 3000);
      }
    }
  }, [highlightPairingId, pairingsLoading]);

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-sm text-red-400 flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="text-red-400 hover:text-red-300 ml-4">&times;</button>
        </div>
      )}

      {/* ── Signature Enforcement ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            {enforcement ? <ShieldCheck size={20} className="text-emerald-400" /> : <ShieldOff size={20} className="text-zinc-500" />}
            <div>
              <div className="text-sm font-medium text-white">Signature Enforcement</div>
              <div className="text-xs text-zinc-500 mt-0.5">When enabled, actions without valid signatures are rejected (401)</div>
            </div>
          </div>
          <button
            onClick={toggleEnforcement}
            disabled={enforcementLoading}
            className={`relative w-11 h-6 rounded-full transition-colors ${enforcement ? 'bg-emerald-500' : 'bg-zinc-700'}`}
          >
            <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${enforcement ? 'translate-x-5' : ''}`} />
          </button>
        </div>
      </div>

      {/* ── Pending Pairings ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">Pending Pairings</div>
          {pairings.length > 0 && (
            <button
              onClick={approveAll}
              className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors"
            >
              <CheckCircle2 size={14} />
              Approve All ({pairings.length})
            </button>
          )}
        </div>
        {pairingsLoading ? (
          <div className="text-sm text-zinc-500 py-6 text-center">Loading...</div>
        ) : pairings.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No pending pairing requests</div>
        ) : (
          <div className="space-y-2">
            {pairings.map((p) => (
              <div
                key={p.id}
                id={`pairing-${p.id}`}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] transition-all"
              >
                <div className="min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-white">{p.agent_id}</span>
                    {p.agent_name && <span className="text-xs text-zinc-500">({p.agent_name})</span>}
                  </div>
                  <div className="text-xs text-zinc-500 mt-1">
                    {timeUntil(p.expires_at)} · <span className="font-mono">{p.algorithm || 'RSASSA-PKCS1-v1_5'}</span>
                  </div>
                </div>
                <button
                  onClick={() => approveOne(p.id)}
                  className="px-3 py-1.5 text-xs font-medium text-white rounded-lg bg-brand hover:bg-brand/90 transition-colors"
                >
                  Approve
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Approved Identities ── */}
      <div className="p-4 rounded-xl bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)]">
        <div className="flex items-center justify-between mb-3">
          <div className="text-sm font-medium text-white">Approved Identities</div>
          <button
            onClick={() => setShowRegisterForm(!showRegisterForm)}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-zinc-300 hover:text-white border border-[rgba(255,255,255,0.06)] hover:border-[rgba(255,255,255,0.12)] rounded-lg transition-colors"
          >
            {showRegisterForm ? <X size={14} /> : <Plus size={14} />}
            {showRegisterForm ? 'Cancel' : 'Register Manually'}
          </button>
        </div>

        {showRegisterForm && (
          <div className="mb-4 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)] space-y-3">
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Agent ID</label>
              <input
                type="text"
                value={registerAgentId}
                onChange={(e) => setRegisterAgentId(e.target.value)}
                placeholder="my-agent"
                className="w-full px-3 py-2 text-sm bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-brand/50"
              />
            </div>
            <div>
              <label className="block text-xs text-zinc-500 mb-1">Public Key (PEM)</label>
              <textarea
                value={registerPublicKey}
                onChange={(e) => setRegisterPublicKey(e.target.value)}
                placeholder={"-----BEGIN PUBLIC KEY-----\n...\n-----END PUBLIC KEY-----"}
                rows={4}
                className="w-full px-3 py-2 text-sm font-mono bg-[rgba(0,0,0,0.3)] border border-[rgba(255,255,255,0.06)] rounded-lg text-white placeholder-zinc-600 focus:outline-none focus:border-brand/50"
              />
            </div>
            <button
              onClick={registerIdentity}
              disabled={registering || !registerAgentId || !registerPublicKey}
              className="px-4 py-2 text-sm font-medium text-white bg-brand hover:bg-brand/90 disabled:opacity-60 rounded-lg transition-colors"
            >
              {registering ? 'Registering...' : 'Register'}
            </button>
          </div>
        )}

        {identitiesLoading ? (
          <div className="text-sm text-zinc-500 py-6 text-center">Loading...</div>
        ) : identities.length === 0 ? (
          <div className="text-sm text-zinc-500 py-6 text-center">No agents enrolled. Share a pairing URL or register directly.</div>
        ) : (
          <div className="space-y-2">
            {identities.map((id) => (
              <div
                key={id.agent_id}
                className="flex items-center justify-between gap-3 p-3 rounded-lg bg-surface-tertiary border border-[rgba(255,255,255,0.06)]"
              >
                <div className="min-w-0">
                  <div className="text-sm font-medium text-white font-mono">{id.agent_id}</div>
                  <div className="text-xs text-zinc-500 mt-1">
                    <span className="font-mono">{id.algorithm || 'RSASSA-PKCS1-v1_5'}</span> · Enrolled {formatDate(id.created_at)}
                  </div>
                </div>
                <button
                  onClick={() => revokeIdentity(id.agent_id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 text-xs text-red-400 hover:text-red-300 border border-red-500/20 hover:border-red-500/40 rounded-lg transition-colors"
                >
                  <Trash2 size={14} />
                  Revoke
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
