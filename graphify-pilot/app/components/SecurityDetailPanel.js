'use client';

import { useEffect, useRef } from 'react';
import {
  X, AlertTriangle, ShieldAlert, Zap, CircleDot, Clock,
  ExternalLink, Shield, Undo2, Info
} from 'lucide-react';
import { Badge } from './ui/Badge';
import { ProgressBar } from './ui/ProgressBar';
import { getAgentColor } from '../lib/colors';

function AgentDot({ agentId }) {
  if (!agentId) return null;
  const colorClass = getAgentColor(agentId);
  return (
    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium border ${colorClass}`}>
      {agentId}
    </span>
  );
}

function SignalDetail({ signal, onClose, onDismiss }) {
  const severityVariant = signal.severity === 'red' ? 'error' : 'warning';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-start gap-2.5">
          <ShieldAlert size={18} className={signal.severity === 'red' ? 'text-red-400' : 'text-yellow-400'} />
          <div>
            <div className="text-sm font-medium text-white">{signal.label}</div>
            <div className="flex items-center gap-2 mt-1.5">
              <Badge variant={severityVariant} size="xs">
                {signal.severity === 'red' ? 'Critical' : 'Warning'}
              </Badge>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{signal.type.replace(/_/g, ' ')}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Agent */}
      {signal.agent_id && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Agent</div>
          <AgentDot agentId={signal.agent_id} />
        </div>
      )}

      {/* Detail */}
      <div>
        <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Detail</div>
        <p className="text-sm text-zinc-300">{signal.detail}</p>
      </div>

      {/* Help */}
      {signal.help && (
        <div className="bg-blue-500/5 border border-blue-500/10 rounded-lg p-3">
          <div className="flex items-start gap-2">
            <Info size={14} className="text-blue-400 mt-0.5 shrink-0" />
            <p className="text-sm text-blue-300">{signal.help}</p>
          </div>
        </div>
      )}

      {/* Related links */}
      {signal.action_id && (
        <a
          href={`/actions/${signal.action_id}`}
          className="flex items-center gap-1.5 text-sm text-brand hover:text-brand/80 transition-colors"
        >
          <ExternalLink size={14} />
          View Action Post-Mortem
        </a>
      )}

      {/* Dismiss */}
      {onDismiss && (
        <button
          onClick={() => { onDismiss(signal); onClose(); }}
          className="w-full mt-2 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-[rgba(255,255,255,0.06)] text-sm text-zinc-400 hover:text-white hover:bg-white/5 transition-colors"
        >
          <X size={14} />
          Dismiss Signal
        </button>
      )}
    </div>
  );
}

function ActionDetail({ action }) {
  const riskScore = parseInt(action.risk_score, 10) || 0;
  const riskColor = riskScore >= 90 ? 'error' : riskScore >= 70 ? 'warning' : 'brand';
  const statusVariant = action.status === 'running' ? 'warning' : action.status === 'failed' ? 'error' : action.status === 'completed' ? 'success' : 'default';

  return (
    <div className="space-y-5">
      {/* Header */}
      <div>
        <div className="flex items-center gap-2 mb-1.5">
          <Zap size={16} className="text-zinc-400" />
          <Badge variant={statusVariant} size="xs">{action.status}</Badge>
          {action.action_type && (
            <span className="text-[10px] text-zinc-500 uppercase tracking-wider">{action.action_type}</span>
          )}
        </div>
        <div className="text-sm font-medium text-white">{action.declared_goal || 'No goal declared'}</div>
      </div>

      {/* Agent */}
      {action.agent_id && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Agent</div>
          <AgentDot agentId={action.agent_id} />
        </div>
      )}

      {/* Risk Score */}
      <div>
        <div className="flex justify-between text-xs mb-1.5">
          <span className="text-zinc-500">Risk Score</span>
          <span className="text-white font-medium tabular-nums">{riskScore}/100</span>
        </div>
        <ProgressBar value={riskScore} color={riskColor} className="h-2" />
      </div>

      {/* Reasoning */}
      {action.reasoning && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Reasoning</div>
          <p className="text-sm text-zinc-300">{action.reasoning}</p>
        </div>
      )}

      {/* Authorization scope */}
      {action.authorization_scope && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Authorization Scope</div>
          <p className="text-sm text-zinc-300 font-mono">{action.authorization_scope}</p>
        </div>
      )}

      {/* Reversible / Side effects */}
      <div className="flex items-center gap-3">
        <div className="flex items-center gap-1.5">
          <Undo2 size={14} className={action.reversible === 1 ? 'text-green-400' : 'text-red-400'} />
          <span className="text-xs text-zinc-300">
            {action.reversible === 1 ? 'Reversible' : 'Irreversible'}
          </span>
        </div>
        {action.side_effects && (
          <div className="flex items-center gap-1.5">
            <AlertTriangle size={14} className="text-yellow-400" />
            <span className="text-xs text-zinc-300">Has side effects</span>
          </div>
        )}
      </div>

      {/* Side effects detail */}
      {action.side_effects && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-wider mb-1.5">Side Effects</div>
          <p className="text-sm text-zinc-300">{action.side_effects}</p>
        </div>
      )}

      {/* Link to post-mortem */}
      <a
        href={`/actions/${action.action_id}`}
        className="flex items-center gap-1.5 text-sm text-brand hover:text-brand/80 transition-colors"
      >
        <ExternalLink size={14} />
        View Post-Mortem
      </a>
    </div>
  );
}

export default function SecurityDetailPanel({ item, type, onClose, onDismiss }) {
  const panelRef = useRef(null);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [onClose]);

  if (!item) return null;

  return (
    <div className="fixed inset-0 z-50">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div
        ref={panelRef}
        className="absolute right-0 top-0 bottom-0 w-full max-w-md bg-surface-secondary border-l border-border overflow-y-auto"
      >
        {/* Close button */}
        <div className="sticky top-0 bg-surface-secondary z-10 flex items-center justify-between px-5 py-4 border-b border-border">
          <span className="text-xs font-medium text-zinc-500 uppercase tracking-wider">
            {type === 'signal' ? 'Signal Detail' : 'Action Detail'}
          </span>
          <button
            onClick={onClose}
            className="p-1.5 text-zinc-500 hover:text-white transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Content */}
        <div className="p-5">
          {type === 'signal' ? (
            <SignalDetail signal={item} onClose={onClose} onDismiss={onDismiss} />
          ) : (
            <ActionDetail action={item} />
          )}
        </div>
      </div>
    </div>
  );
}
