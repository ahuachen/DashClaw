import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import WorkflowVariableInsertButton from '../../app/workflows/components/WorkflowVariableInsertButton.jsx';

describe('WorkflowVariableInsertButton', () => {
  it('renders workflow input and previous step output options and inserts runtime tokens', () => {
    const onInsert = vi.fn();

    render(
      <WorkflowVariableInsertButton
        onInsert={onInsert}
        variableGroups={[
          {
            label: 'Workflow inputs',
            options: [{ label: 'Workflow input variable', token: '${variables.input_name}' }],
          },
          {
            label: 'Previous step outputs',
            options: [{ label: 'Step 1 top chunk', token: '${steps.step_1.output.chunks[0].content}' }],
          },
        ]}
      />
    );

    fireEvent.click(screen.getByRole('button', { name: /insert variable/i }));

    expect(screen.getByText(/workflow inputs/i)).toBeTruthy();
    expect(screen.getByText(/previous step outputs/i)).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: /step 1 top chunk/i }));

    expect(onInsert).toHaveBeenCalledWith('${steps.step_1.output.chunks[0].content}');
    expect(screen.queryByText(/previous step outputs/i)).toBeNull();
  });
});
