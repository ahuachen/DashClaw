import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { fireEvent, render, screen } from '@testing-library/react';

import WorkflowAiDraftPanel from '../../app/workflows/components/WorkflowAiDraftPanel.jsx';

describe('WorkflowAiDraftPanel', () => {
  it('collects description, api key, provider preferences, and submits them', () => {
    const onGenerate = vi.fn();

    render(<WorkflowAiDraftPanel onGenerate={onGenerate} />);

    fireEvent.change(screen.getByLabelText(/workflow request/i), {
      target: { value: 'Search the refund docs and send the answer to Slack.' },
    });
    fireEvent.change(screen.getByLabelText(/api key/i), {
      target: { value: 'sk-test-123' },
    });
    fireEvent.change(screen.getByLabelText(/provider/i), {
      target: { value: 'anthropic' },
    });
    expect(screen.getByLabelText(/model/i).value).toBe('claude-3-5-haiku-latest');
    fireEvent.change(screen.getByLabelText(/model/i), {
      target: { value: 'claude-sonnet-4' },
    });
    fireEvent.click(screen.getByRole('checkbox', { name: /prefer existing linked dashclaw resources/i }));
    fireEvent.click(screen.getByRole('button', { name: /generate draft/i }));

    expect(onGenerate).toHaveBeenCalledWith({
      description: 'Search the refund docs and send the answer to Slack.',
      apiKey: 'sk-test-123',
      provider: 'anthropic',
      model: 'claude-sonnet-4',
      preferExistingResources: false,
    });
  });
});
