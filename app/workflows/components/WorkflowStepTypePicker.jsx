'use client';

import { WORKFLOW_STEP_TYPES } from '../lib/workflowStepFormModel.js';

export default function WorkflowStepTypePicker({ onSelect }) {
  return (
    <div className="grid gap-3 sm:grid-cols-3">
      {WORKFLOW_STEP_TYPES.map((type) => (
        <button
          key={type.value}
          type="button"
          onClick={() => onSelect(type.value)}
          className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)] p-4 text-left transition-colors hover:bg-[rgba(255,255,255,0.04)]"
        >
          <div className="text-sm font-medium text-white">{type.label}</div>
          <p className="mt-2 text-xs text-zinc-400">{type.description}</p>
        </button>
      ))}
    </div>
  );
}
