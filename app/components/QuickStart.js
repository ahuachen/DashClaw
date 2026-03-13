'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, Terminal, Zap, CheckCircle2, Copy, 
  Play, Shield, ArrowRight, Loader2, X, MousePointer2,
  Sparkles
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';
import { useRealtime } from '../hooks/useRealtime';

export default function QuickStart({ onSimulationComplete, onDismiss }) {
  const router = useRouter();
  const [copied, setCopying] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [step, setStep] = useState(1);

  const sdkCode = `// 1. node demo.js
import { DashClaw } from 'dashclaw'

const claw = new DashClaw({ 
  apiKey: process.env.DASHCLAW_KEY 
})

await claw.guard({
  actionType: "deploy",
  riskScore: 85
})`;

  // Auto-advance steps based on real-time activity
  useRealtime((event) => {
    // If we see an action or guard decision, we know they've instrumented correctly
    if (event === 'action.created' || event === 'guard.decision.created' || event === 'decision.created') {
      setStep(3);
    }
  });

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopying(true);
    // If they copy the code, they are likely moving to step 2
    if (step < 2) setStep(2);
    setTimeout(() => setCopying(false), 2000);
  };

  const handleSimulate = async () => {
    setSimulating(true);
    try {
      // Simulate a governed decision by calling the real API
      const res = await fetch('/api/actions', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          agent_id: 'simulator-bot',
          agent_name: 'Simulator Bot',
          declared_goal: 'Test governance flow',
          action_type: 'deploy',
          reasoning: 'Verifying system posture and policy enforcement.',
          risk_score: 45,
          confidence: 90,
          status: 'completed',
          systems_touched: ['production-api'],
          timestamp_start: new Date().toISOString()
        })
      });
      
      if (res.ok) {
        const data = await res.json();
        const actionId = data.action_id || 'act_real_1';
        
        if (onSimulationComplete) onSimulationComplete();
        setStep(3);
        
        // Wait a beat for the user to see the success before redirecting to replay
        setTimeout(() => {
          router.push(`/decisions/${actionId}`);
        }, 1500);
      } else {
        const err = await res.json();
        console.error('Simulation API error:', err);
      }
    } catch (err) {
      console.error('Simulation failed:', err);
    } finally {
      // Keep simulating true during the redirect pause
    }
  };

  return (
    <div className="relative grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8 group/qs">
      {onDismiss && (
        <button 
          onClick={onDismiss}
          className="absolute -top-3 -right-3 z-10 p-1.5 bg-surface-secondary border border-white/10 rounded-full text-zinc-500 hover:text-white opacity-0 group-hover/qs:opacity-100 transition-all shadow-xl"
          title="Dismiss guide"
        >
          <X size={14} />
        </button>
      )}
      {/* 1. The Onboarding Card */}
      <Card className="border-brand/20 bg-brand/5 overflow-visible" hover={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center text-brand shadow-[0_0_20px_rgba(244,63,94,0.1)]">
              <Rocket size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Connect your first agent</h2>
              <p className="text-sm text-zinc-400 font-medium tracking-tight">See your first governed decision in under 2 minutes.</p>
            </div>
          </div>

          <div className="space-y-6 mt-6">
            {/* Step 1: Install */}
            <div className={`flex gap-4 transition-all duration-300 ${step < 1 ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${step >= 1 ? 'bg-brand text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  {step > 1 ? <CheckCircle2 size={14} /> : '1'}
                </div>
                <div className={`flex-1 w-px my-1 transition-colors ${step > 1 ? 'bg-brand/30' : 'bg-white/5'}`} />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm font-semibold text-white mb-1">Install SDK</div>
                <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-white/5 font-mono text-xs text-zinc-300 group/term relative">
                  <Terminal size={12} className="text-zinc-500" />
                  <span>npm install dashclaw</span>
                  <button 
                    onClick={() => {
                      navigator.clipboard.writeText('npm install dashclaw');
                      if (step === 1) setStep(2);
                    }}
                    className="absolute right-2 opacity-0 group-hover/term:opacity-100 transition-opacity p-1 hover:text-white"
                  >
                    <Copy size={10} />
                  </button>
                </div>
              </div>
            </div>

            {/* Step 2: Act */}
            <div className={`flex gap-4 transition-all duration-300 ${step < 2 ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${step >= 2 ? 'bg-brand text-white' : 'bg-zinc-800 text-zinc-500'}`}>
                  {step > 2 ? <CheckCircle2 size={14} /> : '2'}
                </div>
                <div className={`flex-1 w-px my-1 transition-colors ${step > 2 ? 'bg-brand/30' : 'bg-white/5'}`} />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm font-semibold text-white mb-1">Run Example</div>
                <div className="relative group">
                  <pre className={`bg-black/40 p-3 rounded border font-mono text-[10px] overflow-x-auto max-h-[140px] transition-colors ${step === 2 ? 'border-brand/30 text-zinc-200' : 'border-white/5 text-zinc-500'}`}>
                    {sdkCode}
                  </pre>
                  <button 
                    onClick={handleCopy}
                    disabled={step < 2}
                    className="absolute top-2 right-2 p-1.5 bg-zinc-800 rounded border border-white/10 text-zinc-400 hover:text-white transition-colors disabled:opacity-0"
                  >
                    {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Success */}
            <div className={`flex gap-4 transition-all duration-300 ${step < 3 ? 'opacity-40 grayscale' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold transition-colors ${step === 3 ? 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.3)]' : 'bg-zinc-800 text-zinc-500'}`}>
                  {step === 3 ? <Sparkles size={14} /> : '3'}
                </div>
              </div>
              <div className="flex-1 relative">
                <div className="text-sm font-semibold text-white mb-1">Watch Governance Happen</div>
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Mission Control will light up the moment your agent acts.
                </p>
                
                {/* Visual Hint - Re-anchored to the text for clarity */}
                {step === 2 && (
                  <div className="absolute -right-4 top-0 hidden xl:flex items-center gap-2 animate-pulse">
                    <MousePointer2 size={16} className="text-brand rotate-[-90deg] fill-brand" />
                    <span className="text-[10px] font-bold text-brand uppercase tracking-widest whitespace-nowrap bg-brand/10 px-2 py-1 rounded border border-brand/20">
                      Awaiting agent signal...
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. The Simulation Card */}
      <Card className="border-white/5 bg-surface-secondary flex flex-col justify-center items-center text-center p-8 relative overflow-hidden" hover={false}>
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-zinc-700 to-transparent opacity-20" />
        <div className="w-16 h-16 rounded-2xl bg-zinc-800/50 border border-white/5 flex items-center justify-center text-zinc-400 mb-6 shadow-inner">
          <Play size={24} className={simulating ? 'animate-pulse text-brand' : ''} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Not ready to code?</h3>
        <p className="text-zinc-400 text-sm max-w-[280px] mb-8 leading-relaxed">
          Simulate a real-time agent decision to see DashClaw governance in action right now.
        </p>
        
        <button 
          onClick={handleSimulate}
          disabled={simulating}
          className="group relative flex items-center gap-2 px-8 py-3 bg-white text-black font-bold rounded-xl hover:scale-[1.02] active:scale-[0.98] transition-all disabled:opacity-50 disabled:scale-100 shadow-[0_10px_20px_rgba(0,0,0,0.2)]"
        >
          {simulating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Shield size={18} />
          )}
          {simulating ? 'Processing Decision...' : 'Run Simulation'}
          {!simulating && <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />}
        </button>
        
        <div className="mt-8 flex items-center gap-4 text-[9px] text-zinc-600 uppercase font-bold tracking-[0.2em]">
          <span>Policy Check</span>
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>Risk Scoring</span>
          <div className="w-1 h-1 rounded-full bg-zinc-800" />
          <span>Ledger Record</span>
        </div>
      </Card>
    </div>
  );
}
