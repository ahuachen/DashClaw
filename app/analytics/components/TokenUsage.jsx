import { formatCost, formatTokens } from '../../lib/formatCost';

export default function TokenUsage({ tokens }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="text-[10px] font-medium uppercase tracking-widest text-zinc-500 mb-4">Token Usage</div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-5">
        <div>
          <div className="text-[10px] text-zinc-500">Input Tokens</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total_in)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Output Tokens</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total_out)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Total</div>
          <div className="text-lg font-semibold text-white">{formatTokens(tokens.total)}</div>
        </div>
        <div>
          <div className="text-[10px] text-zinc-500">Cost / 1M Tokens</div>
          <div className="text-lg font-semibold text-white">{formatCost(tokens.cost_per_million)}</div>
        </div>
      </div>

      {tokens.top_consumers?.length > 0 && (
        <div>
          <div className="text-[10px] text-zinc-500 uppercase tracking-widest mb-2">Top Consumers</div>
          <div className="space-y-2">
            {tokens.top_consumers.map(c => (
              <div key={c.agent_id} className="flex items-center justify-between text-xs">
                <span className="text-zinc-300">{c.agent_name || c.agent_id}</span>
                <span className="text-zinc-400">
                  {formatTokens(c.total_tokens)} tokens &middot; {formatCost(c.cost)} &middot; avg {formatTokens(c.avg_per_action)}/action
                </span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
