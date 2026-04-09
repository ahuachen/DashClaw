'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import PageLayout from '../../../../components/PageLayout.js';
import WorkflowRunHeader from './components/WorkflowRunHeader.jsx';
import WorkflowRunTimeline from './components/WorkflowRunTimeline.jsx';
import ArtifactsTab from '../../../../components/ArtifactsTab.jsx';
import Link from 'next/link';

export default function WorkflowRunDetailPage() {
  const { templateId, runActionId } = useParams();
  const [run, setRun] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [resuming, setResuming] = useState(false);

  useEffect(() => {
    async function loadRun() {
      try {
        const res = await fetch(`/api/workflows/templates/${templateId}/runs/${runActionId}`);
        if (!res.ok) {
          if (res.status === 404) {
            setError('not_found');
          } else {
            setError('fetch_failed');
          }
          return;
        }
        const data = await res.json();
        setRun(data);
      } catch {
        setError('fetch_failed');
      } finally {
        setLoading(false);
      }
    }
    loadRun();
  }, [templateId, runActionId]);

  async function handleResume() {
    setResuming(true);
    try {
      const res = await fetch(`/api/workflows/templates/${templateId}/runs/${runActionId}/resume`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (res.ok) {
        const data = await res.json();
        window.location.href = `/workflows/${templateId}/runs/${data.action_id}`;
      } else {
        const err = await res.json().catch(() => ({}));
        alert(err.message || 'Resume failed');
      }
    } catch {
      alert('Resume failed');
    } finally {
      setResuming(false);
    }
  }

  if (loading) {
    return (
      <PageLayout title="Loading run...">
        <div className="animate-pulse text-zinc-500 text-sm">Loading workflow run...</div>
      </PageLayout>
    );
  }

  if (error === 'not_found') {
    return (
      <PageLayout title="Run not found">
        <div className="text-center py-12">
          <p className="text-zinc-400 mb-4">This workflow run was not found.</p>
          <Link href={`/workflows/${templateId}`} className="text-blue-400 hover:text-blue-300 text-sm">
            Back to workflow
          </Link>
        </div>
      </PageLayout>
    );
  }

  if (error || !run) {
    return (
      <PageLayout title="Error">
        <div className="text-center py-12">
          <p className="text-red-400 mb-4">Failed to load workflow run.</p>
          <button onClick={() => window.location.reload()} className="text-blue-400 hover:text-blue-300 text-sm">
            Retry
          </button>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout title={run.template_name || 'Workflow Run'} maturity="beta">
      <div className="space-y-8">
        <WorkflowRunHeader run={run} templateId={templateId} onResume={handleResume} resuming={resuming} />
        <div>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Steps</h2>
          <WorkflowRunTimeline steps={run.steps} />
        </div>
        <div>
          <h2 className="text-sm font-medium text-zinc-300 mb-3">Artifacts</h2>
          <ArtifactsTab actionId={runActionId} />
        </div>
      </div>
    </PageLayout>
  );
}
