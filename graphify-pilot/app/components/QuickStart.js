'use client';

import { useState } from 'react';
import {
  Rocket, Terminal, CheckCircle2, Copy, X, MousePointer2,
  Sparkles, FileText, Key, Globe
} from 'lucide-react';
import { Card } from './ui/Card';
import { useRealtime } from '../hooks/useRealtime';
import { isDemoMode } from '../lib/isDemoMode';

export default function QuickStart({ onDismiss }) {
  const [copied, setCopying] = useState(false);
  const [envCopied, setEnvCopied] = useState(false);
  const [step, setStep] = useState(1);

  // In demo mode, show the placeholder — don't imply dashclaw.io is a hosted service.
  // For self-hosted instances, use the actual origin so the snippet works out of the box.
  const baseUrl = isDemoMode()
    ? 'https://your-dashclaw.vercel.app'
    : (typeof window !== 'undefined' ? window.location.origin : 'https://your-dashclaw.vercel.app');

  const sdkCode = `// 1. node --env-file=.env demo.js
import { DashClaw } from 'dashclaw'

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || '${baseUrl}',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-first-agent'
})

await claw.guard({
  actionType: "deploy",
  riskScore: 85
})`;

  const envFileContent = `DASHCLAW_API_KEY=<your-api-key>\nDASHCLAW_BASE_URL=${baseUrl}`;

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

  const handleEnvCopy = () => {
    navigator.clipboard.writeText(envFileContent);
    setEnvCopied(true);
    setTimeout(() => setEnvCopied(false), 2000);
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
                  {isDemoMode()
                    ? 'Self-host to connect real agents. In demo mode, use the simulator to see governance.'
                    : 'Mission Control will light up the moment your agent acts.'}
                </p>

                {/* Visual Hint - Re-anchored to the text for clarity */}
                {step === 2 && (
                  <div className="absolute -right-4 top-0 hidden xl:flex items-center gap-2 animate-pulse">
                    <MousePointer2 size={16} className="text-brand rotate-[-90deg] fill-brand" />
                    <span className="text-[10px] font-bold text-brand uppercase tracking-widest whitespace-nowrap bg-brand/10 px-2 py-1 rounded border border-brand/20">
                      {isDemoMode() ? 'Awaiting simulation signal...' : 'Awaiting agent signal...'}
                    </span>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </Card>

      {/* 2. Environment Setup Guide */}
      <Card className="border-white/5 bg-surface-secondary overflow-hidden" hover={false}>
        <div className="p-6">
          <div className="flex items-center gap-3 mb-5">
            <div className="w-10 h-10 rounded-xl bg-zinc-800/80 border border-white/5 flex items-center justify-center text-zinc-400">
              <FileText size={20} />
            </div>
            <div>
              <h3 className="text-lg font-bold text-white">Environment Setup</h3>
              <p className="text-sm text-zinc-500">Configure your agent project</p>
            </div>
          </div>

          <div className="space-y-5">
            {/* .env file */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Key size={13} className="text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Create a <code className="text-brand/80 font-mono">.env</code> file</span>
              </div>
              <div className="relative group/env">
                <pre className="bg-black/40 p-3 rounded border border-white/5 font-mono text-[11px] text-zinc-300">
                  {envFileContent}
                </pre>
                <button
                  onClick={handleEnvCopy}
                  className="absolute top-2 right-2 p-1.5 bg-zinc-800 rounded border border-white/10 text-zinc-400 hover:text-white transition-colors opacity-0 group-hover/env:opacity-100"
                >
                  {envCopied ? <CheckCircle2 size={12} className="text-emerald-400" /> : <Copy size={12} />}
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5 leading-relaxed">
                Your API key starts with <code className="text-zinc-500">oc_live_</code> — find it in <span className="text-zinc-400">Settings</span> or the Vercel deploy output.
              </p>
            </div>

            {/* baseUrl explanation */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Globe size={13} className="text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Base URL</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Set <code className="text-zinc-300 font-mono text-[10px]">baseUrl</code> to your deployed DashClaw instance URL.
                {isDemoMode() ? (
                  <> DashClaw is self-hosted — there is no shared cloud. After deploying via the Vercel button, your URL will look like <code className="text-zinc-300 font-mono text-[10px]">https://your-app.vercel.app</code>.</>
                ) : (
                  <> For this instance, use <code className="text-zinc-300 font-mono text-[10px]">{baseUrl}</code>.</>
                )}
              </p>
            </div>

            {/* Run command */}
            <div>
              <div className="flex items-center gap-2 mb-2">
                <Terminal size={13} className="text-zinc-500" />
                <span className="text-xs font-semibold text-zinc-300 uppercase tracking-wide">Run it</span>
              </div>
              <div className="flex items-center gap-2 bg-black/40 p-2 rounded border border-white/5 font-mono text-[11px] text-zinc-300 group/run relative">
                <span className="text-zinc-600">$</span>
                <span>node --env-file=.env demo.js</span>
                <button
                  onClick={() => navigator.clipboard.writeText('node --env-file=.env demo.js')}
                  className="absolute right-2 opacity-0 group-hover/run:opacity-100 transition-opacity p-1 hover:text-white"
                >
                  <Copy size={10} />
                </button>
              </div>
              <p className="text-[10px] text-zinc-600 mt-1.5">
                Requires Node.js 20+. The <code className="text-zinc-500">--env-file</code> flag loads your <code className="text-zinc-500">.env</code> automatically.
              </p>
            </div>
          </div>
        </div>
      </Card>
    </div>
  );
}
