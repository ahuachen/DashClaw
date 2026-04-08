'use client';

import { AlertTriangle } from 'lucide-react';

export default function WorkflowStepLegacyNotice({ legacyFallback }) {
  if (!legacyFallback) return null;

  const { nodeCount, edgeCount, nodeTypes, previewSteps } = legacyFallback;

  return (
    <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 space-y-4">
      <div className="flex items-start gap-3">
        <div className="mt-0.5 rounded-lg bg-amber-500/20 p-2 text-amber-300">
          <AlertTriangle size={16} />
        </div>
        <div>
          <div className="text-sm font-medium text-amber-200">This workflow was saved with the legacy graph editor</div>
          <p className="mt-1 text-sm text-amber-100/80">
            DashClaw now runs workflows as ordered executable steps. This older graph data is shown read-only so you can inspect it honestly instead of editing it through a misleading canvas.
          </p>
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Nodes</div>
          <div className="mt-1 text-sm font-medium text-white">{nodeCount} node{nodeCount === 1 ? '' : 's'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Edges</div>
          <div className="mt-1 text-sm font-medium text-white">{edgeCount} edge{edgeCount === 1 ? '' : 's'}</div>
        </div>
        <div className="rounded-lg border border-white/10 bg-black/20 p-3">
          <div className="text-xs uppercase tracking-wider text-zinc-500">Node types</div>
          <div className="mt-1 text-sm font-medium text-white">{nodeTypes.length > 0 ? nodeTypes.join(', ') : 'Unknown'}</div>
        </div>
      </div>

      <div>
        <div className="text-xs uppercase tracking-wider text-zinc-500">Preview</div>
        {previewSteps.length === 0 ? (
          <p className="mt-2 text-sm text-zinc-400">No readable legacy nodes were found in this workflow definition.</p>
        ) : (
          <ul className="mt-2 space-y-2">
            {previewSteps.map((previewStep) => (
              <li key={previewStep} className="rounded-lg border border-white/10 bg-black/20 px-3 py-2 text-sm text-zinc-200">
                {previewStep}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
