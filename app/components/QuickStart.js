'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { 
  Rocket, Terminal, Zap, CheckCircle2, Copy, 
  Play, Shield, ArrowRight, Loader2, X
} from 'lucide-react';
import { Card, CardContent } from './ui/Card';
import { Badge } from './ui/Badge';

export default function QuickStart({ onSimulationComplete, onDismiss }) {
  const router = useRouter();
  const [copied, setCopying] = useState(false);
  const [simulating, setSimulating] = useState(false);
  const [step, setStep] = useState(1);

  const sdkCode = `const { DashClaw } = require('@dashclaw/sdk');
const claw = new DashClaw({ apiKey: 'YOUR_API_KEY' });

// 1. Evaluate policy before acting
const decision = await claw.guard({
  actionType: 'deploy',
  riskScore: 85
});

// 2. Record the action
if (decision.allowed) {
  await claw.createAction({
    goal: 'Deploy production hotfix',
    status: 'completed'
  });
}`;

  const handleCopy = () => {
    navigator.clipboard.writeText(sdkCode);
    setCopying(true);
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
        const actionId = data.action_id || 'act_demo_001';
        
        if (onSimulationComplete) onSimulationComplete();
        setStep(3);
        
        // Wait a beat for the user to see the success before redirecting to replay
        setTimeout(() => {
          router.push(`/actions/${actionId}`);
        }, 1500);
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
      <Card className="border-brand/20 bg-brand/5" hover={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-brand/20 flex items-center justify-center text-brand">
              <Rocket size={20} />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">Connect your first agent</h2>
              <p className="text-sm text-zinc-400">Under 60 seconds to your first governed decision.</p>
            </div>
          </div>

          <div className="space-y-6 mt-6">
            {/* Step 1: Install */}
            <div className={`flex gap-4 transition-opacity ${step < 1 ? 'opacity-40' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step > 1 ? 'bg-emerald-500 text-black' : 'bg-brand text-white'}`}>
                  {step > 1 ? <CheckCircle2 size={14} /> : '1'}
                </div>
                <div className="flex-1 w-px bg-white/10 my-1" />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm font-semibold text-white mb-1">Install SDK</div>
                <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-white/5 font-mono text-xs text-zinc-300">
                  <Terminal size={12} className="text-zinc-500" />
                  <span>npm install @dashclaw/sdk</span>
                </div>
              </div>
            </div>

            {/* Step 2: Act */}
            <div className={`flex gap-4 transition-opacity ${step < 2 ? 'opacity-40' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step > 2 ? 'bg-emerald-500 text-black' : 'bg-brand text-white'}`}>
                  {step > 2 ? <CheckCircle2 size={14} /> : '2'}
                </div>
                <div className="flex-1 w-px bg-white/10 my-1" />
              </div>
              <div className="flex-1 pb-4">
                <div className="text-sm font-semibold text-white mb-1">Instrument Decision</div>
                <div className="relative group">
                  <pre className="bg-black/40 p-3 rounded border border-white/5 font-mono text-[10px] text-zinc-400 overflow-x-auto max-h-[120px]">
                    {sdkCode}
                  </pre>
                  <button 
                    onClick={handleCopy}
                    className="absolute top-2 right-2 p-1.5 bg-zinc-800 rounded border border-white/10 text-zinc-400 hover:text-white transition-colors"
                  >
                    {copied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                  </button>
                </div>
              </div>
            </div>

            {/* Step 3: Success */}
            <div className={`flex gap-4 transition-opacity ${step < 3 ? 'opacity-40' : ''}`}>
              <div className="flex flex-col items-center">
                <div className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold ${step === 3 ? 'bg-emerald-500 text-black' : 'bg-zinc-800 text-zinc-500'}`}>
                  {step === 3 ? <CheckCircle2 size={14} /> : '3'}
                </div>
              </div>
              <div className="flex-1">
                <div className="text-sm font-semibold text-white mb-1">Watch Governance Happen</div>
                <p className="text-xs text-zinc-500">Mission Control will light up the moment your agent acts.</p>
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. The Simulation Card */}
      <Card className="border-white/5 bg-surface-secondary flex flex-col justify-center items-center text-center p-8" hover={false}>
        <div className="w-16 h-16 rounded-full bg-zinc-800 flex items-center justify-center text-zinc-400 mb-6">
          <Play size={24} />
        </div>
        <h3 className="text-xl font-bold text-white mb-2">Not ready to code?</h3>
        <p className="text-zinc-400 text-sm max-w-[280px] mb-8">
          Simulate a real-time agent decision to see DashClaw governance in action right now.
        </p>
        
        <button 
          onClick={handleSimulate}
          disabled={simulating}
          className="group relative flex items-center gap-2 px-6 py-3 bg-white text-black font-bold rounded-xl hover:bg-zinc-200 transition-all disabled:opacity-50"
        >
          {simulating ? (
            <Loader2 size={18} className="animate-spin" />
          ) : (
            <Shield size={18} />
          )}
          {simulating ? 'Processing Decision...' : 'Run Simulation'}
          {!simulating && <ArrowRight size={16} className="ml-1 group-hover:translate-x-1 transition-transform" />}
        </button>
        
        <div className="mt-6 flex items-center gap-4 text-[10px] text-zinc-600 uppercase font-bold tracking-widest">
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
