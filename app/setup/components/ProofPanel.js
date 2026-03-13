import { CodeBlock } from './Common';

export function ProofPanel({ view, proofDownloadHref }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Verification proof</p>
      <p className="mt-3 text-sm text-zinc-300">
        Download a structured JSON artifact for the current verify view. It records what was checked, the current verification state, and the next actions that still remain.
      </p>
      <p className="mt-3 text-xs text-zinc-500">
        {view.isAuthenticated
          ? 'Operator mode includes richer diagnostics and commands when available.'
          : 'Public-safe mode is sanitized before export and hides operator-only details.'}
      </p>

      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] p-4">
        <p className="text-xs text-zinc-400">Artifact includes</p>
        <div className="mt-3 space-y-2 text-xs text-zinc-500">
          <p>Timestamp, viewer mode, and overall verification state.</p>
          <p>Per-section summaries and per-check status details.</p>
          <p>Recommended next steps, SDK validation guidance, and any attached live validation proof.</p>
        </div>
      </div>

      <div className="mt-4">
        <a
          href={proofDownloadHref}
          className="inline-flex items-center rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm text-brand transition-colors hover:border-brand/60 hover:bg-brand/15"
        >
          Download JSON proof
        </a>
      </div>

      <div className="mt-4 rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] p-4">
        <p className="text-xs text-zinc-400">Proof preview</p>
        <CodeBlock>{JSON.stringify(view.proofArtifact.verification, null, 2)}</CodeBlock>
      </div>
    </div>
  );
}
