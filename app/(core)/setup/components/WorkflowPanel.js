export function WorkflowPanel({ workflow }) {
  return (
    <div id="workflow" className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <div className="mb-4">
        <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Verification workflow</p>
        <p className="mt-2 text-sm text-zinc-300">
          Use this sequence to move from core readiness into live integration proof.
        </p>
      </div>

      <div className="space-y-3">
        {workflow.map((step, index) => (
          <WorkflowStep key={step.id} step={step} index={index} />
        ))}
      </div>
    </div>
  );
}

function WorkflowStep({ step, index }) {
  const styles = {
    pass: 'border-emerald-900/40 text-emerald-300',
    warn: 'border-amber-900/40 text-amber-300',
    fail: 'border-red-900/40 text-red-300',
    blocked: 'border-red-900/40 text-red-300',
    pending: 'border-cyan-900/40 text-cyan-300',
  }[step.status] || 'border-[rgba(255,255,255,0.08)] text-zinc-300';

  return (
    <div className={`rounded-xl border bg-[#0d0d0d] p-4 ${styles}`}>
      <div className="flex items-start gap-3">
        <div className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-current text-[11px] font-semibold">
          {index + 1}
        </div>
        <div className="min-w-0">
          <p className="text-sm font-semibold">{step.title}</p>
          <p className="mt-1 text-xs text-zinc-300">{step.summary}</p>
          <p className="mt-2 text-xs text-zinc-500">Proof: {step.proof}</p>
          {step.nextAction ? <p className="mt-1 text-xs text-zinc-400">Next action: {step.nextAction}</p> : null}
        </div>
      </div>
    </div>
  );
}
