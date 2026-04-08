'use client';

import WorkflowRunStepCard from './WorkflowRunStepCard.jsx';

export default function WorkflowRunTimeline({ steps }) {
  if (!steps || steps.length === 0) {
    return <div className="text-sm text-zinc-500">No steps recorded for this run.</div>;
  }

  return (
    <div className="space-y-2">
      {steps.map((step) => (
        <WorkflowRunStepCard key={step.step_result_id || step.step_id} step={step} />
      ))}
    </div>
  );
}
