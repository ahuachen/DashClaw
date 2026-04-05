import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  listWorkflowTemplates,
  getWorkflowTemplate,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  duplicateWorkflowTemplate,
  launchWorkflowTemplate,
  shapeTemplate,
} from '../../app/lib/repositories/workflow-templates.repository.js';

function makeSqlMock(responses) {
  const queue = [...responses];
  const calls = [];
  const fn = vi.fn((strings, ...values) => {
    calls.push({ strings, values });
    return Promise.resolve(queue.shift() ?? []);
  });
  fn.calls = calls;
  return fn;
}

function dbRow(overrides = {}) {
  return {
    template_id: 'wft_123',
    org_id: 'org_1',
    name: 'Release Hotfix',
    slug: 'release-hotfix',
    description: 'Ship urgent patches',
    objective: 'Deploy to prod safely',
    steps_json: '[{"id":"plan"},{"id":"test"}]',
    model_strategy_id: null,
    model_strategy_snapshot: null,
    linked_prompt_template_ids_json: '["pt_1"]',
    linked_policy_ids_json: '["pol_1","pol_2"]',
    linked_knowledge_collection_ids_json: '[]',
    linked_capability_ids_json: '[]',
    linked_capability_tags_json: '["deploy"]',
    version: 1,
    status: 'draft',
    created_by: 'user_1',
    created_at: '2026-04-05T10:00:00Z',
    updated_at: '2026-04-05T10:00:00Z',
    ...overrides,
  };
}

describe('workflow-templates.repository', () => {
  beforeEach(() => vi.clearAllMocks());

  describe('shapeTemplate', () => {
    it('parses json columns back into arrays/objects', () => {
      const shaped = shapeTemplate(dbRow());
      expect(shaped.steps).toEqual([{ id: 'plan' }, { id: 'test' }]);
      expect(shaped.linked_prompt_template_ids).toEqual(['pt_1']);
      expect(shaped.linked_policy_ids).toEqual(['pol_1', 'pol_2']);
      expect(shaped.linked_capability_tags).toEqual(['deploy']);
      expect(shaped.linked_knowledge_collection_ids).toEqual([]);
    });

    it('returns null for missing row', () => {
      expect(shapeTemplate(null)).toBeNull();
      expect(shapeTemplate(undefined)).toBeNull();
    });

    it('falls back gracefully on malformed json', () => {
      const shaped = shapeTemplate(dbRow({ steps_json: 'not-json' }));
      expect(shaped.steps).toEqual([]);
    });
  });

  describe('listWorkflowTemplates', () => {
    it('returns shaped templates ordered by repository', async () => {
      const sql = makeSqlMock([[dbRow(), dbRow({ template_id: 'wft_456' })]]);
      const result = await listWorkflowTemplates(sql, 'org_1');
      expect(result).toHaveLength(2);
      expect(result[0].template_id).toBe('wft_123');
      expect(result[0].steps).toEqual([{ id: 'plan' }, { id: 'test' }]);
    });
  });

  describe('getWorkflowTemplate', () => {
    it('returns null when not found', async () => {
      const sql = makeSqlMock([[]]);
      const result = await getWorkflowTemplate(sql, 'org_1', 'wft_missing');
      expect(result).toBeNull();
    });

    it('returns shaped template when found', async () => {
      const sql = makeSqlMock([[dbRow()]]);
      const result = await getWorkflowTemplate(sql, 'org_1', 'wft_123');
      expect(result.template_id).toBe('wft_123');
      expect(result.version).toBe(1);
    });
  });

  describe('createWorkflowTemplate', () => {
    it('throws when name is missing', async () => {
      const sql = makeSqlMock([]);
      await expect(createWorkflowTemplate(sql, 'org_1', {})).rejects.toThrow(/name is required/);
    });

    it('generates a wft_ id and slug from name', async () => {
      const sql = makeSqlMock([[dbRow({ template_id: 'wft_generated', slug: 'new-flow' })]]);
      const result = await createWorkflowTemplate(sql, 'org_1', { name: 'New Flow' });
      expect(result.template_id).toBe('wft_generated');
      // Slug was generated and passed through the INSERT
      const insertCall = sql.calls[0];
      const values = insertCall.values;
      expect(values).toContain('new-flow');
      // version starts at 1, status defaults to draft
      expect(values).toContain(1);
      expect(values).toContain('draft');
    });

    it('stringifies linked arrays into json columns', async () => {
      const sql = makeSqlMock([[dbRow()]]);
      await createWorkflowTemplate(sql, 'org_1', {
        name: 'Test',
        linked_policy_ids: ['pol_1', 'pol_2'],
        linked_capability_tags: ['deploy'],
      });
      const values = sql.calls[0].values;
      expect(values).toContain(JSON.stringify(['pol_1', 'pol_2']));
      expect(values).toContain(JSON.stringify(['deploy']));
    });
  });

  describe('updateWorkflowTemplate', () => {
    it('returns null when template does not exist', async () => {
      const sql = makeSqlMock([[]]); // getWorkflowTemplate → empty
      const result = await updateWorkflowTemplate(sql, 'org_1', 'wft_missing', { name: 'X' });
      expect(result).toBeNull();
    });

    it('does not bump version when steps are unchanged', async () => {
      const row = dbRow();
      const sql = makeSqlMock([[row], [row]]);
      await updateWorkflowTemplate(sql, 'org_1', 'wft_123', { name: 'Renamed' });
      // Second call is the UPDATE; find version in its values
      const updateValues = sql.calls[1].values;
      expect(updateValues).toContain(1); // version stayed at 1
    });

    it('bumps version by 1 when steps change', async () => {
      const row = dbRow();
      const updatedRow = dbRow({ version: 2, steps_json: '[{"id":"new"}]' });
      const sql = makeSqlMock([[row], [updatedRow]]);
      const result = await updateWorkflowTemplate(sql, 'org_1', 'wft_123', {
        steps: [{ id: 'new' }],
      });
      expect(result.version).toBe(2);
      const updateValues = sql.calls[1].values;
      expect(updateValues).toContain(2);
    });
  });

  describe('duplicateWorkflowTemplate', () => {
    it('returns null for missing source template', async () => {
      const sql = makeSqlMock([[]]);
      const result = await duplicateWorkflowTemplate(sql, 'org_1', 'wft_missing');
      expect(result).toBeNull();
    });

    it('creates a draft copy with version reset to 1', async () => {
      const source = dbRow({ version: 5, status: 'active' });
      const inserted = dbRow({ template_id: 'wft_dup', version: 1, status: 'draft' });
      const sql = makeSqlMock([[source], [inserted]]);
      const result = await duplicateWorkflowTemplate(sql, 'org_1', 'wft_123');
      expect(result.template_id).toBe('wft_dup');
      expect(result.version).toBe(1);
      expect(result.status).toBe('draft');
      const insertValues = sql.calls[1].values;
      // Status should be 'draft' in the INSERT
      expect(insertValues).toContain('draft');
    });
  });

  describe('launchWorkflowTemplate', () => {
    it('returns null for missing template', async () => {
      const sql = makeSqlMock([[]]);
      const result = await launchWorkflowTemplate(sql, 'org_1', 'wft_missing');
      expect(result).toBeNull();
    });

    it('inserts an action_records row and returns the action id', async () => {
      const sql = makeSqlMock([
        [dbRow()], // getWorkflowTemplate
        [],        // INSERT INTO action_records (no RETURNING needed)
      ]);

      const result = await launchWorkflowTemplate(sql, 'org_1', 'wft_123', {
        agent_id: 'agent_deploy',
      });

      expect(result.action_id).toMatch(/^act_/);
      expect(result.template_id).toBe('wft_123');
      expect(result.template_version).toBe(1);

      // Verify the INSERT included our workflow metadata
      const insertValues = sql.calls[1].values;
      expect(insertValues).toContain('workflow_launch');
      expect(insertValues).toContain('workflow:wft_123');
      // Reasoning field should carry WORKFLOW_LAUNCH_META=...
      const reasoning = insertValues.find(
        (v) => typeof v === 'string' && v.startsWith('WORKFLOW_LAUNCH_META=')
      );
      expect(reasoning).toBeTruthy();
      const meta = JSON.parse(reasoning.replace('WORKFLOW_LAUNCH_META=', ''));
      expect(meta.template_id).toBe('wft_123');
      expect(meta.template_name).toBe('Release Hotfix');
      expect(meta.linked_policy_ids).toEqual(['pol_1', 'pol_2']);
    });

    it('snapshots resolved strategy onto the template when provided', async () => {
      const strategy = { primary: { provider: 'openai', model: 'gpt-4.1' } };
      const sql = makeSqlMock([
        [dbRow()],  // getWorkflowTemplate
        [],         // INSERT action_records
        [],         // UPDATE workflow_templates SET model_strategy_snapshot
      ]);

      const result = await launchWorkflowTemplate(sql, 'org_1', 'wft_123', {
        resolvedStrategy: strategy,
      });

      expect(result.resolved_strategy).toEqual(strategy);
      // Third call is the snapshot UPDATE
      expect(sql.calls[2].values).toContain(JSON.stringify(strategy));
    });
  });
});
