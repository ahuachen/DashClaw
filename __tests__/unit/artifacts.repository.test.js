import { describe, expect, it } from 'vitest';
import { shapeArtifact } from '../../app/lib/repositories/artifacts.repository.js';

describe('shapeArtifact', () => {
  it('shapes a raw row into an artifact object', () => {
    const row = {
      artifact_id: 'art_1',
      org_id: 'org_1',
      artifact_type: 'json',
      name: 'Step output',
      description: 'Auto-captured',
      content_json: '{"text":"hello"}',
      content_url: null,
      mime_type: 'application/json',
      size_bytes: 42,
      source_action_id: 'act_1',
      source_step_id: 'step_1',
      source_agent_id: 'bot_1',
      retention_days: 90,
      tags_json: '["auto-captured"]',
      metadata_json: '{"step_type":"prompt"}',
      created_at: '2026-04-09T10:00:00Z',
      updated_at: '2026-04-09T10:00:00Z',
    };

    const artifact = shapeArtifact(row);
    expect(artifact.artifact_id).toBe('art_1');
    expect(artifact.content).toEqual({ text: 'hello' });
    expect(artifact.tags).toEqual(['auto-captured']);
    expect(artifact.metadata).toEqual({ step_type: 'prompt' });
    expect(artifact.source_action_id).toBe('act_1');
  });

  it('handles null/malformed JSON gracefully', () => {
    const row = {
      artifact_id: 'art_2',
      org_id: 'org_1',
      artifact_type: 'file',
      name: 'Report',
      content_json: 'not-json',
      tags_json: null,
      metadata_json: null,
    };

    const artifact = shapeArtifact(row);
    expect(artifact.content).toBeNull();
    expect(artifact.tags).toEqual([]);
    expect(artifact.metadata).toEqual({});
  });

  it('returns null for null input', () => {
    expect(shapeArtifact(null)).toBeNull();
  });
});
