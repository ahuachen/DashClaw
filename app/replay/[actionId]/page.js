'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useParams, useSearchParams } from 'next/navigation';
import {
  ShieldCheck, ShieldAlert, Zap, Clock, Info, ExternalLink,
  ChevronRight, ArrowRight, Code, Copy, Check
} from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';

// Shared components for the replay story
const DashClawLogo = ({ size = 20, className = "" }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}>
    <path d="M12 2L4 5V11C4 16.55 7.41 21.74 12 23C16.59 21.74 20 16.55 20 11V5L12 2Z" fill="#F43F5E" fillOpacity="0.2" stroke="#F43F5E" strokeWidth="2" />
    <path d="M9 12L11 14L15 10" stroke="#F43F5E" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export default function PublicReplayPage() {
  const params = useParams();
  const searchParams = useSearchParams();
  const actionId = params.actionId;
  const isEmbed = searchParams.get('embed') === '1';

  const [action, setAction] = useState(null);
  const [guardDecision, setGuardDecision] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    try {
      // Fetch public-safe action data
      const res = await fetch(`/api/actions/${actionId}`);
      if (!res.ok) {
        if (res.status === 404) { setError('Decision not found'); return; }
        throw new Error('Failed to fetch');
      }
      const data = await res.json();
      
      // In public view, we strictly white-list what we show
      setAction({
        action_id: data.action.action_id,
        declared_goal: data.action.declared_goal,
        action_type: data.action.action_type,
        status: data.action.status,
        risk_score: data.action.risk_score,
        reasoning: data.action.reasoning,
        agent_name: data.action.agent_name || data.action.agent_id,
        agent_id: data.action.agent_id,
        timestamp_start: data.action.timestamp_start,
        verified: data.action.verified,
        duration_ms: data.action.duration_ms,
        output_summary: data.action.output_summary
      });

      // Try to find governance data
      if (data.action.agent_id) {
        try {
          const guardRes = await fetch(`/api/guard?agent_id=${encodeURIComponent(data.action.agent_id)}&limit=10`);
          if (guardRes.ok) {
            const guardData = await guardRes.json();
            const actionStart = new Date(data.action.timestamp_start).getTime();
            const match = (guardData.decisions || []).find(gd =>
              gd.action_type === data.action.action_type &&
              Math.abs(new Date(gd.created_at).getTime() - actionStart) <= 60000
            );
            if (match) setGuardDecision(match);
          }
        } catch { /* ignore */ }
      }
    } catch (err) {
      console.error('Failed to fetch:', err);
      setError('Could not load this decision replay.');
    } finally {
      setLoading(false);
    }
  }, [actionId]);

  useEffect(() => {
    if (actionId) fetchData();
  }, [actionId, fetchData]);

  const copyEmbed = () => {
    const url = `${window.location.origin}/replay/${actionId}?embed=1`;
    const code = `<iframe src="${url}" width="100%" height="400" frameborder="0" style="border:1px solid rgba(255,255,255,0.1); border-radius:12px;"></iframe>`;
    navigator.clipboard.writeText(code);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex items-center justify-center">
        <div className="h-8 w-8 border-2 border-brand border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (error || !action) {
    return (
      <div className="min-h-screen bg-[#0a0a0a] flex flex-col items-center justify-center p-6">
        <DashClawLogo size={48} className="mb-8 opacity-20" />
        <div className="text-zinc-500 font-medium text-center">{error || 'Replay unavailable'}</div>
        <Link href="/" className="mt-6 text-brand text-sm hover:underline">Back to DashClaw</Link>
      </div>
    );
  }

  const getStatusColor = (status) => {
    if (status === 'completed' || status === 'allow') return 'text-emerald-400';
    if (status === 'failed' || status === 'block') return 'text-red-400';
    if (status === 'require_approval' || status === 'running') return 'text-amber-400';
    return 'text-zinc-400';
  };

  const getRiskColor = (score) => {
    if (score >= 70) return 'text-red-400';
    if (score >= 40) return 'text-amber-400';
    return 'text-emerald-400';
  };

  // ─── Render ───
  return (
    <div className={`min-h-screen ${isEmbed ? 'bg-transparent' : 'bg-[#0a0a0a]'} flex flex-col items-center selection:bg-brand/30`}>
      
      {!isEmbed && (
        <nav className="w-full border-b border-white/5 bg-black/20 backdrop-blur-md sticky top-0 z-50">
          <div className="max-w-5xl mx-auto px-4 h-14 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <DashClawLogo size={20} />
              <span className="text-sm font-bold text-white tracking-tight">DASHCLAW REPLAY</span>
            </div>
            <div className="flex items-center gap-4">
              <button 
                onClick={copyEmbed}
                className="flex items-center gap-1.5 text-[10px] font-bold text-zinc-500 hover:text-white transition-colors uppercase tracking-widest"
              >
                {copied ? <Check size={12} className="text-emerald-500" /> : <Code size={12} />}
                {copied ? 'Copied!' : 'Copy Embed'}
              </button>
              <Link href="/" className="text-[10px] font-bold text-brand hover:text-brand-hover transition-colors uppercase tracking-widest">
                Try DashClaw
              </Link>
            </div>
          </div>
        </nav>
      )}

      <main className={`w-full max-w-2xl px-4 ${isEmbed ? 'py-4' : 'py-12 md:py-20'}`}>
        
        {/* THE STORY CARD - CONCISE & SCREENSHOT FRIENDLY */}
        <div className="relative group/story">
          {/* Subtle Glow */}
          <div className="absolute -inset-0.5 bg-gradient-to-b from-brand/20 to-transparent rounded-2xl blur opacity-20 group-hover/story:opacity-30 transition-opacity" />
          
          <div className="relative bg-[#0d0d0d] border border-white/[0.08] rounded-2xl overflow-hidden shadow-2xl">
            
            {/* Header / ID */}
            <div className="px-6 py-4 border-b border-white/[0.04] flex items-center justify-between bg-white/[0.01]">
              <div className="flex items-center gap-3">
                <Badge variant={action.status === 'completed' ? 'success' : 'error'} size="xs" className="font-black uppercase tracking-tighter">
                  {action.status}
                </Badge>
                <span className="text-[10px] font-mono text-zinc-600 tracking-tight">{action.action_id}</span>
              </div>
              <div className="flex items-center gap-1.5">
                {action.verified ? (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-emerald-500/80 uppercase tracking-widest">
                    <ShieldCheck size={10} /> Verified Identity
                  </div>
                ) : (
                  <div className="flex items-center gap-1 text-[9px] font-bold text-zinc-600 uppercase tracking-widest">
                    <Info size={10} /> Unsigned
                  </div>
                )}
              </div>
            </div>

            <div className="p-8 space-y-10 relative">
              {/* Connector Line */}
              <div className="absolute left-[47px] top-12 bottom-12 w-px bg-gradient-to-b from-blue-500/50 via-emerald-500/50 to-emerald-500/50 opacity-20" />

              {/* 1. THE INTENT */}
              <div className="relative flex gap-6">
                <div className="z-10 h-10 w-10 shrink-0 rounded-xl bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 shadow-[0_0_15px_rgba(59,130,246,0.1)]">
                  <Zap size={20} className="fill-blue-400/20" />
                </div>
                <div>
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Agent Intent</div>
                  <h1 className="text-xl font-bold text-white leading-tight mb-2">{action.declared_goal}</h1>
                  <div className="flex items-center gap-2">
                    <span className="text-xs text-zinc-500 font-medium">Actor:</span>
                    <span className="px-1.5 py-0.5 rounded bg-zinc-800 text-[10px] font-bold text-zinc-300 uppercase tracking-wider">{action.agent_name}</span>
                  </div>
                </div>
              </div>

              {/* 2. THE GOVERNANCE */}
              <div className="relative flex gap-6">
                <div className={`z-10 h-10 w-10 shrink-0 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center shadow-[0_0_15px_rgba(16,185,129,0.1)] ${
                  guardDecision?.decision === 'block' ? 'text-red-400 bg-red-500/10 border-red-500/20 shadow-[0_0_15px_rgba(244,63,94,0.1)]' : 'text-emerald-400'
                }`}>
                  <ShieldCheck size={20} className="fill-current/20" />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Governance Check</div>
                  <div className="flex items-center gap-3 flex-wrap">
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className={`text-xs font-bold uppercase ${getStatusColor(guardDecision?.decision || 'allow')}`}>
                        {guardDecision?.decision?.toUpperCase() || 'ALLOWED'}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 rounded-lg bg-white/5 border border-white/5">
                      <span className="text-[10px] text-zinc-500 font-bold uppercase tracking-widest">Risk Score:</span>
                      <span className={`text-xs font-bold ${getRiskColor(action.risk_score)}`}>{action.risk_score || 0}</span>
                    </div>
                  </div>
                  {guardDecision?.reason && (
                    <p className="mt-3 text-sm text-zinc-400 italic border-l-2 border-white/5 pl-3 leading-relaxed">
                      &ldquo;{guardDecision.reason}&rdquo;
                    </p>
                  )}
                </div>
              </div>

              {/* 3. THE OUTCOME */}
              <div className="relative flex gap-6">
                <div className={`z-10 h-10 w-10 shrink-0 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center ${getStatusColor(action.status)} shadow-[0_0_15px_rgba(255,255,255,0.05)]`}>
                  <Check size={20} />
                </div>
                <div className="flex-1">
                  <div className="text-[10px] font-black text-zinc-600 uppercase tracking-[0.2em] mb-1">Result</div>
                  <div className="flex items-center gap-2 mb-2">
                    <span className={`text-xl font-black tracking-tight ${getStatusColor(action.status)} uppercase`}>
                      {action.status}
                    </span>
                    {action.duration_ms && (
                      <span className="text-xs text-zinc-600 font-mono">in {(action.duration_ms/1000).toFixed(2)}s</span>
                    )}
                  </div>
                  {action.output_summary && (
                    <div className="text-xs text-zinc-300 font-mono bg-black/40 p-3 rounded-lg border border-white/5 max-h-[100px] overflow-auto leading-relaxed">
                      {action.output_summary}
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Footer / Branding */}
            <div className="px-6 py-4 border-t border-white/[0.04] bg-white/[0.01] flex items-center justify-between">
              <div className="flex items-center gap-2">
                <DashClawLogo size={14} className="grayscale opacity-50" />
                <span className="text-[9px] font-bold text-zinc-600 uppercase tracking-[0.2em]">Verified by DashClaw Runtime</span>
              </div>
              <div className="text-[9px] font-mono text-zinc-700">
                {new Date(action.timestamp_start).toUTCString()}
              </div>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        {!isEmbed && (
          <div className="mt-8 flex flex-col items-center gap-6">
            <div className="flex items-center gap-3">
              <Link 
                href="/mission-control"
                className="px-6 py-3 bg-white text-black font-black text-xs uppercase tracking-widest rounded-xl hover:bg-zinc-200 transition-all flex items-center gap-2 shadow-lg"
              >
                Launch Console <ArrowRight size={14} />
              </Link>
              <button 
                onClick={copyEmbed}
                className="px-6 py-3 bg-zinc-900 text-zinc-400 border border-white/10 font-black text-xs uppercase tracking-widest rounded-xl hover:text-white hover:border-white/20 transition-all flex items-center gap-2"
              >
                <Code size={14} /> {copied ? 'Code Copied' : 'Embed Replay'}
              </button>
            </div>
            
            <p className="text-[10px] text-zinc-600 font-medium uppercase tracking-[0.2em] max-w-sm text-center leading-relaxed">
              DashClaw is the decision infrastructure for AI agents. Governed by Practical Systems.
            </p>
          </div>
        )}
      </main>
    </div>
  );
}
