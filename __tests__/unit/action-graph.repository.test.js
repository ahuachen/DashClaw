import { describe, it, expect, vi, beforeEach } from 'vitest';
import { buildActionGraph } from '../../app/lib/repositories/actions.repository.js';

// Tagged-template mock: each call shifts the next response off the queue.
function makeSqlMock(responses) {
  const queue = [...responses];
  const fn = vi.fn(() => Promise.resolve(queue.shift() ?? []));
  return fn;
}

describe('buildActionGraph', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns null when root action not found', async () => {
    const sql = makeSqlMock([[]]); // getActionTraceData fetches action first → empty → null
    const graph = await buildActionGraph(sql, 'org_1', 'act_missing');
    expect(graph).toBeNull();
  });

  it('builds nodes and edges from trace data with parent, sub-action, assumption, loop', async () => {
    const rootAction = {
      action_id: 'act_root',
      agent_id: 'agent_1',
      agent_name: 'Deploy Agent',
      action_type: 'deploy',
      declared_goal: 'Release hotfix',
      status: 'completed',
      risk_score: 82,
      timestamp_start: '2026-04-05T10:00:00Z',
      timestamp_end: '2026-04-05T10:02:00Z',
      parent_action_id: 'act_parent',
      systems_touched: '[]',
      error_message: null,
    };
    const parentAction = {
      action_id: 'act_parent',
      agent_id: 'agent_1',
      action_type: 'plan',
      declared_goal: 'Release plan',
      status: 'completed',
      risk_score: 30,
      timestamp_start: '2026-04-05T09:55:00Z',
      parent_action_id: null,
    };
    const subAction = {
      action_id: 'act_child',
      agent_id: 'agent_1',
      action_type: 'test',
      declared_goal: 'Smoke test',
      status: 'completed',
      risk_score: 10,
      timestamp_start: '2026-04-05T10:01:00Z',
    };
    const assumption = {
      assumption_id: 'as_1',
      action_id: 'act_root',
      assumption: 'DB is read-only',
      validated: 0,
      invalidated: 1,
      invalidated_reason: 'Write detected',
      created_at: '2026-04-05T10:00:30Z',
    };
    const loop = {
      loop_id: 'lp_1',
      action_id: 'act_root',
      loop_type: 'verification',
      description: 'Verify rollback',
      status: 'open',
      priority: 'high',
      created_at: '2026-04-05T10:01:30Z',
    };

    // getActionTraceData call order:
    //   1. action fetch
    //   2-5. Promise.all: assumptions, loops, relatedActions, subActions
    //   6+. parent chain walk (one query per generation; exits when parent_action_id is null)
    const sql = makeSqlMock([
      [rootAction],      // 1. initial action
      [assumption],      // 2. assumptions
      [loop],            // 3. loops
      [],                // 4. relatedActions
      [subAction],       // 5. subActions
      [parentAction],    // 6. parent chain step 1 (parentAction.parent_action_id is null → loop exits)
    ]);

    const graph = await buildActionGraph(sql, 'org_1', 'act_root');

    expect(graph).not.toBeNull();
    expect(graph.rootActionId).toBe('act_root');

    const nodeIds = graph.nodes.map((n) => n.id);
    expect(nodeIds).toContain('action:act_root');
    expect(nodeIds).toContain('action:act_parent');
    expect(nodeIds).toContain('action:act_child');
    expect(nodeIds).toContain('assumption:as_1');
    expect(nodeIds).toContain('loop:lp_1');

    const rootNode = graph.nodes.find((n) => n.id === 'action:act_root');
    expect(rootNode.type).toBe('action');
    expect(rootNode.status).toBe('completed');
    expect(rootNode.riskScore).toBe(82);
    expect(rootNode.isRoot).toBe(true);
    expect(rootNode.agentId).toBe('agent_1');

    // Parent → root edge
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'action:act_parent',
        target: 'action:act_root',
        type: 'parent_child',
      })
    );
    // Root → sub-action edge
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'action:act_root',
        target: 'action:act_child',
        type: 'parent_child',
      })
    );
    // Assumption → action edge
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'assumption:as_1',
        target: 'action:act_root',
        type: 'assumption_of',
      })
    );
    // Loop → action edge
    expect(graph.edges).toContainEqual(
      expect.objectContaining({
        source: 'loop:lp_1',
        target: 'action:act_root',
        type: 'loop_from',
      })
    );

    // Invalidated assumption is visible in node status
    const asNode = graph.nodes.find((n) => n.id === 'assumption:as_1');
    expect(asNode.status).toBe('invalidated');
    expect(asNode.meta.invalidated_reason).toBe('Write detected');

    // Loop node carries priority metadata
    const loopNode = graph.nodes.find((n) => n.id === 'loop:lp_1');
    expect(loopNode.status).toBe('open');
    expect(loopNode.meta.priority).toBe('high');
  });

  it('deduplicates nodes when the same action appears in multiple relationships', async () => {
    const rootAction = {
      action_id: 'act_root',
      agent_id: 'agent_1',
      action_type: 'deploy',
      declared_goal: 'Root goal',
      status: 'completed',
      risk_score: 50,
      timestamp_start: '2026-04-05T10:00:00Z',
      parent_action_id: null,
      systems_touched: '[]',
    };

    const sql = makeSqlMock([
      [rootAction], // initial
      [],           // assumptions
      [],           // loops
      [],           // related
      [],           // sub-actions
    ]);

    const graph = await buildActionGraph(sql, 'org_1', 'act_root');

    const actionNodeCount = graph.nodes.filter((n) => n.id === 'action:act_root').length;
    expect(actionNodeCount).toBe(1);
    expect(graph.edges).toHaveLength(0);
  });
});
