'use client';

import { useState, useActionState, useOptimistic, transition } from 'react';
import { 
  Bot, Shield, Database, ArrowRight, Play, 
  CheckCircle2, XCircle, Clock, Activity, 
  Terminal, ShieldCheck, ShieldAlert, Cpu
} from 'lucide-react';

export default function GuardSimulation() {
  const [step, setStep] = useState('idle'); // idle, requesting, evaluating, approval, finished
  const [decision, setDecision] = useState(null); // allowed, blocked

  // Logic for the simulation "Action"
  async function runSimulationAction() {
    setStep('requesting');
    await new Promise(r => setTimeout(r, 800));
    
    setStep('evaluating');
    await new Promise(r => setTimeout(r, 1200));
    
    setStep('approval');
    return null;
  }

  const [, startSimulation, isPending] = useActionState(runSimulationAction, null);

  const handleDecision = (type) => {
    setDecision(type);
    setStep('finished');
  };

  const reset = () => {
    setStep('idle');
    setDecision(null);
  };

  return (
    <div className="w-full max-w-4xl mx-auto mt-16 group/sim">
      <div className="relative p-px rounded-3xl bg-gradient-to-b from-white/10 to-transparent shadow-2xl overflow-hidden">
        {/* Subtle background glow */}
        <div className="absolute -top-24 -left-24 w-48 h-48 bg-brand/10 blur-[100px] rounded-full group-hover/sim:bg-brand/20 transition-all duration-1000"></div>
        
        <div className="relative bg-[#080808] rounded-[23px] overflow-hidden border border-white/5">
          {/* Header Bar */}
          <div className="px-5 py-4 border-b border-white/5 flex items-center justify-between bg-white/[0.01]">
            <div className="flex items-center gap-3">
              <div className="flex gap-1.5">
                <div className="w-3 h-3 rounded-full bg-zinc-800 border border-white/5"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-800 border border-white/5"></div>
                <div className="w-3 h-3 rounded-full bg-zinc-800 border border-white/5"></div>
              </div>
              <div className="h-4 w-px bg-zinc-800 mx-1"></div>
              <div className="flex items-center gap-2">
                <Activity size={12} className="text-brand animate-pulse" />
                <span className="text-[10px] font-mono text-zinc-500 uppercase tracking-widest font-bold">Runtime Interception</span>
              </div>
            </div>
            
            <div className="flex items-center gap-4">
              {step === 'finished' && (
                <button 
                  onClick={reset}
                  className="text-[10px] font-bold text-zinc-500 hover:text-brand uppercase tracking-tight transition-colors"
                >
                  Restart Demo
                </button>
              )}
              <div className="px-2 py-0.5 rounded bg-zinc-900 border border-zinc-800 text-[9px] font-mono text-zinc-500">
                v2.1.0-stable
              </div>
            </div>
          </div>

          <div className="flex flex-col md:flex-row min-h-[440px]">
            {/* Left Column: The Agent Environment */}
            <div className="flex-1 p-8 flex flex-col bg-gradient-to-br from-transparent to-white/[0.01] text-left">
              <div className="flex items-center gap-3 mb-6">
                <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/5 flex items-center justify-center shadow-inner">
                  <Cpu size={16} className="text-zinc-400" />
                </div>
                <div>
                  <h4 className="text-[11px] font-bold text-zinc-300 uppercase tracking-tight">Autonomous Actor</h4>
                  <p className="text-[9px] text-zinc-500 font-mono">agent-moltfire-01</p>
                </div>
              </div>

              <div className="flex-1 font-mono text-[13px] leading-relaxed text-left">
                <div className="flex items-center gap-3 text-zinc-500 mb-4">
                  <span className="text-brand/50 font-sans">#</span>
                  <span className="italic">Attempting cross-region deployment...</span>
                </div>
                
                <div className="flex items-start gap-3 text-zinc-300 mb-6">
                  <span className="text-zinc-600 mt-1.5 select-none opacity-50 font-mono text-xs">&gt;</span>
                  <div className="bg-black/50 p-4 rounded-lg border border-white/5 w-full font-mono text-[12px] leading-relaxed shadow-inner text-left">
                    <div>
                      <span className="text-purple-400">const</span>
                      <span className="text-zinc-300"> decision = </span>
                      <span className="text-purple-400">await</span>
                      <span className="text-zinc-300"> claw.</span>
                      <span className="text-yellow-200">guard</span>
                      <span className="text-zinc-400">({'{'}</span>
                    </div>
                    <div className="pl-6">
                      <span className="text-zinc-400">action: </span>
                      <span className="text-green-400">&quot;db_migration&quot;</span>
                      <span className="text-zinc-400">,</span>
                    </div>
                    <div className="pl-6">
                      <span className="text-zinc-400">risk: </span>
                      <span className="text-cyan-400">92</span>
                    </div>
                    <div><span className="text-zinc-400">{'}'})</span></div>
                  </div>
                </div>

                {step !== 'idle' && (
                  <div className="space-y-3 animate-in fade-in slide-in-from-left-4 duration-700">
                    <div className="flex items-center gap-3 text-[11px]">
                      {step === 'requesting' ? (
                        <div className="w-1.5 h-1.5 rounded-full bg-brand animate-ping"></div>
                      ) : (
                        <CheckCircle2 size={12} className="text-green-500" />
                      )}
                      <span className={step === 'requesting' ? "text-zinc-300" : "text-zinc-500"}>Connecting to DashClaw Runtime...</span>
                    </div>
                    
                    {(step === 'evaluating' || step === 'approval' || step === 'finished') && (
                      <div className="flex items-center gap-3 text-[11px]">
                        {step === 'evaluating' ? (
                          <div className="w-1.5 h-1.5 rounded-full bg-brand animate-ping"></div>
                        ) : (
                          <CheckCircle2 size={12} className="text-green-500" />
                        )}
                        <span className={step === 'evaluating' ? "text-zinc-300" : "text-zinc-500"}>Evaluating semantic policies...</span>
                      </div>
                    )}

                    {step === 'finished' && (
                      <div className={`mt-4 p-4 rounded-xl border ${decision === 'allowed' ? 'bg-green-500/5 border-green-500/20 text-green-400' : 'bg-red-500/5 border-red-500/20 text-red-400'} animate-in zoom-in-95 duration-300`}>
                        <div className="flex items-center gap-3 mb-1">
                          {decision === 'allowed' ? <CheckCircle2 size={18} /> : <ShieldAlert size={18} />}
                          <span className="font-bold text-sm tracking-tight text-white uppercase">
                            {decision === 'allowed' ? 'Execution Permitted' : 'Execution Blocked'}
                          </span>
                        </div>
                        <p className="text-[10px] opacity-80 pl-7 leading-relaxed text-zinc-400">
                          {decision === 'allowed' 
                            ? 'The agent has proceeded with the action. Evidence record act_9283... has been signed.' 
                            : 'Policy violation detected. The runtime prevented the agent from executing this action.'}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>

              {step === 'idle' && (
                <button 
                  onClick={() => startSimulation()}
                  className="group/btn relative mt-4 overflow-hidden bg-brand text-white py-3 px-6 rounded-xl font-bold text-xs uppercase tracking-widest shadow-lg shadow-brand/20 transition-all hover:bg-brand-hover active:scale-95"
                >
                  <div className="relative z-10 flex items-center justify-center gap-2">
                    <Play size={14} fill="currentColor" /> Trigger Action
                  </div>
                  <div className="absolute inset-0 bg-gradient-to-r from-white/0 via-white/20 to-white/0 -translate-x-full group-hover/btn:animate-shimmer"></div>
                </button>
              )}
            </div>

            {/* Right Column: DashClaw Guard Logic */}
            <div className="md:w-[380px] p-8 bg-zinc-900/30 border-l border-white/5 relative flex flex-col shadow-2xl">
              <div className="flex items-center justify-between mb-8">
                <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-xl bg-brand/10 border border-brand/20 flex items-center justify-center shadow-[0_0_15px_rgba(249,115,22,0.1)]">
                    <Shield size={16} className="text-brand" />
                  </div>
                  <h4 className="text-[11px] font-bold text-brand uppercase tracking-tight">Policy Firewall</h4>
                </div>
                <div className="flex gap-1">
                  <div className={`w-1.5 h-1.5 rounded-full ${step !== 'idle' ? 'bg-green-500 animate-pulse' : 'bg-zinc-700'}`}></div>
                </div>
              </div>

              <div className="flex-1 space-y-4 flex flex-col">
                {/* ── Box 1: Policy Match ── */}
                <div className={`relative p-4 rounded-2xl border transition-all duration-700 ${
                  step === 'idle' || step === 'requesting' 
                    ? 'bg-transparent border-white/[0.03] opacity-20' 
                    : 'bg-black border-white/5 shadow-xl opacity-100'
                }`}>
                  <div className="flex justify-between items-center mb-3">
                    <span className="text-[9px] text-zinc-500 font-bold uppercase tracking-widest text-[8px]">Active Policy Match</span>
                    {step === 'evaluating' ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-brand/10 border border-brand/20 text-[8px] font-bold text-brand animate-pulse">
                        SCANNING
                      </div>
                    ) : (step === 'approval' || step === 'finished') ? (
                      <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-red-500/10 border border-red-500/20 text-[8px] font-bold text-red-400">
                        CRITICAL
                      </div>
                    ) : null}
                  </div>

                  <div className={`space-y-2 transition-all duration-500 ${
                    (step === 'evaluating' || step === 'approval' || step === 'finished') ? 'opacity-100 blur-0' : 'opacity-0 blur-sm'
                  }`}>
                    <div className="text-[11px] font-mono text-zinc-200 bg-zinc-900/80 p-2 rounded border border-white/5 leading-relaxed relative overflow-hidden">
                      <span className="text-zinc-500 uppercase text-[9px]">Rule:</span> PRODUCTION_INTEGRITY<br/>
                      <span className="text-zinc-500 uppercase text-[9px]">Trigger:</span> RISK_SCORE &gt; 80
                      {step === 'evaluating' && (
                        <div className="absolute inset-0 bg-gradient-to-r from-transparent via-brand/10 to-transparent animate-shimmer -translate-x-full"></div>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[10px] px-1">
                      <span className="text-zinc-500 text-[9px]">Status</span>
                      <span className={step === 'evaluating' ? "text-zinc-600 italic" : "text-brand font-bold"}>
                        {step === 'evaluating' ? 'Analyzing...' : 'Interception Required'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* ── Box 2: Authorization ── */}
                <div className="flex-1 relative overflow-hidden min-h-[220px]">
                  {/* Idle/Standby State */}
                  {(step === 'idle' || step === 'requesting' || step === 'evaluating') && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center opacity-20 transition-opacity duration-700">
                      <Radar className="text-zinc-500 mb-2" size={48} />
                      <p className="text-[9px] text-zinc-500 font-mono uppercase tracking-[0.2em]">Decisional Stream Standby</p>
                    </div>
                  )}

                  {/* Approval Prompt */}
                  <div className={`transition-all duration-700 absolute inset-0 z-40 ${
                    step === 'approval' ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
                  }`}>
                    <div className="p-5 rounded-2xl bg-gradient-to-b from-brand/10 to-transparent border border-brand/20 shadow-2xl h-full flex flex-col">
                      <div className="flex items-center gap-2 mb-4">
                        <Clock size={14} className="text-brand animate-spin-slow" />
                        <span className="text-[10px] font-extrabold text-white uppercase tracking-widest">Operator Authorization</span>
                      </div>
                      
                      <p className="text-[11px] text-zinc-400 mb-5 leading-relaxed">
                        This action exceeds the autonomy threshold. A manual override is required to proceed.
                      </p>

                      <div className="mt-auto flex gap-2">
                        <button 
                          onClick={() => handleDecision('allowed')}
                          className="flex-1 py-2.5 rounded-xl bg-green-500 text-white text-[10px] font-bold hover:bg-green-600 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-green-500/20 relative z-50 cursor-pointer"
                        >
                          ALLOW
                        </button>
                        <button 
                          onClick={() => handleDecision('blocked')}
                          className="flex-1 py-2.5 rounded-xl bg-red-500 text-white text-[10px] font-bold hover:bg-red-600 transition-all hover:scale-[1.02] active:scale-95 shadow-lg shadow-red-500/20 relative z-50 cursor-pointer"
                        >
                          DENY
                        </button>
                      </div>
                    </div>
                  </div>

                  {/* Finished / Evidence Record */}
                  <div className={`transition-all duration-700 absolute inset-0 z-30 ${
                    step === 'finished' ? 'translate-y-0 opacity-100' : 'translate-y-8 opacity-0 pointer-events-none'
                  }`}>
                    <div className="p-4 rounded-2xl bg-black border border-white/5 text-center space-y-3 shadow-xl h-full flex flex-col justify-center">
                      <div className="inline-flex w-10 h-10 mx-auto items-center justify-center rounded-full bg-green-500/10 border border-green-500/20 text-green-400 mb-1">
                        <ShieldCheck size={20} />
                      </div>
                      <div className="text-[11px] font-bold text-zinc-200 uppercase tracking-widest">Evidence Recorded</div>
                      <div className="flex items-center gap-2 bg-zinc-900/50 p-2 rounded-lg border border-white/5">
                        <div className="text-[9px] font-mono text-zinc-500 flex-1 truncate text-left italic">
                          act_9283_dec_signed_v1...
                        </div>
                        <div className="flex items-center gap-1 px-1.5 py-0.5 rounded bg-green-500/10 border border-green-500/20">
                          <CheckCircle2 size={10} className="text-green-400" />
                          <span className="text-[8px] font-bold text-green-400 uppercase tracking-tighter">verified</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              </div>

              {/* Connecting animation */}
              {step === 'requesting' && (
                <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/60 backdrop-blur-sm z-30">
                  <div className="w-12 h-12 rounded-2xl border-2 border-brand border-t-transparent animate-spin mb-4"></div>
                  <span className="text-[10px] font-mono text-brand font-bold tracking-widest animate-pulse uppercase">Syncing State</span>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
      
      <style jsx global>{`
        @keyframes shimmer {
          100% { transform: translateX(100%); }
        }
        .animate-shimmer {
          animation: shimmer 2s infinite;
        }
        .animate-spin-slow {
          animation: spin 3s linear infinite;
        }
      `}</style>
    </div>
  );
}

function Radar({ className, size }) {
  return (
    <svg 
      className={className} 
      width={size} 
      height={size} 
      viewBox="0 0 24 24" 
      fill="none" 
      stroke="currentColor" 
      strokeWidth="1.5" 
      strokeLinecap="round" 
      strokeLinejoin="round"
    >
      <circle cx="12" cy="12" r="10" opacity="0.1" />
      <circle cx="12" cy="12" r="6" opacity="0.2" />
      <circle cx="12" cy="12" r="2" opacity="0.4" />
      <path d="M12 12L22 12" className="animate-spin-slow origin-center" />
      <path d="M12 12L12 2" className="animate-spin-slow origin-center opacity-50" />
    </svg>
  );
}
