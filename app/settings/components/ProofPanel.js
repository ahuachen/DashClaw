export function ProofPanel({ view, proofDownloadHref }) {
  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.06)] bg-[#0d0d0d] px-5 py-4">
      <div className="flex items-center justify-between">
        <p className="text-xs text-tertiary">Verification proof</p>
        <a
          href={proofDownloadHref}
          className="text-xs text-tertiary underline transition-colors hover:text-secondary"
        >
          Download JSON
        </a>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer text-xs text-disabled select-none">
          Preview artifact
        </summary>
        <pre className="mt-2 overflow-x-auto whitespace-pre-wrap rounded-lg border border-[rgba(255,255,255,0.04)] bg-[#050505] px-3 py-2 text-[10px] font-mono text-tertiary">
          {JSON.stringify(view.proofArtifact.verification, null, 2)}
        </pre>
      </details>
    </div>
  );
}
