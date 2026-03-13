
export function demoListActions(fixtures, url) {
  const sp = url.searchParams;
  const agentId = sp.get('agent_id') || undefined;
  const status = sp.get('status') || undefined;
  const actionType = sp.get('action_type') || undefined;
  const riskMinRaw = sp.get('risk_min');
  const riskMin = riskMinRaw ? parseInt(riskMinRaw, 10) : undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  let items = fixtures.actions.slice();
  if (agentId) items = items.filter(a => a.agent_id === agentId);
  if (status) items = items.filter(a => a.status === status);
  if (actionType) items = items.filter(a => a.action_type === actionType);
  if (Number.isFinite(riskMin)) items = items.filter(a => (parseInt(a.risk_score, 10) || 0) >= riskMin);

  items.sort((a, b) => (b.timestamp_start || '').localeCompare(a.timestamp_start || ''));

  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  const statsSource = items;
  const stats = {
    total: statsSource.length,
    completed: statsSource.filter(a => a.status === 'completed').length,
    failed: statsSource.filter(a => a.status === 'failed').length,
    running: statsSource.filter(a => a.status === 'running').length,
    high_risk: statsSource.filter(a => (parseInt(a.risk_score, 10) || 0) >= 70).length,
    avg_risk: statsSource.length ? (statsSource.reduce((s, a) => s + (parseInt(a.risk_score, 10) || 0), 0) / statsSource.length) : 0,
    total_cost: statsSource.reduce((s, a) => s + (parseFloat(a.cost_estimate) || 0), 0),
  };

  return { actions: paged, total, stats, lastUpdated: new Date().toISOString() };
}

export function demoCreateAction(fixtures, body) {
  const action_id = body.action_id || `act_sim_${Math.random().toString(36).slice(2, 10)}`;
  const action = {
    ...body,
    action_id,
    org_id: 'org_demo',
    timestamp_start: body.timestamp_start || new Date().toISOString(),
    status: body.status || 'completed',
    risk_score: body.risk_score || 0,
    confidence: body.confidence || 100,
    verified: true,
  };
  
  // In a real middleware we can't persist to fixtures (read-only import), 
  // but we return the object to simulate success.
  return { 
    action, 
    action_id, 
    decision: { decision: 'allow', reason: 'Demo mode simulation auto-permitted.' },
    security: { clean: true, findings_count: 0 }
  };
}

export function demoAgents(fixtures) {
  const map = new Map();
  for (const a of fixtures.actions) {
    const prev = map.get(a.agent_id) || { agent_id: a.agent_id, agent_name: a.agent_name, action_count: 0, last_active: null };
    prev.action_count += 1;
    const ts = a.timestamp_start || null;
    if (ts && (!prev.last_active || ts > prev.last_active)) prev.last_active = ts;
    map.set(a.agent_id, prev);
  }
  const agents = Array.from(map.values()).sort((a, b) => (b.last_active || '').localeCompare(a.last_active || ''));
  return { agents, lastUpdated: new Date().toISOString() };
}

export function demoActionDetail(fixtures, actionId) {
  const action = fixtures.actions.find(a => a.action_id === actionId) || null;
  if (!action) return null;
  const open_loops = fixtures.loops
    .filter(l => l.action_id === actionId)
    .map(({ agent_id, agent_name, declared_goal, action_type, ...rest }) => rest);
  const assumptions = fixtures.assumptions.filter(a => a.action_id === actionId);
  return { action, open_loops, assumptions };
}

export function demoAssumptions(fixtures, url) {
  const sp = url.searchParams;
  const drift = sp.get('drift') === 'true';
  const agentId = sp.get('agent_id') || undefined;
  const actionId = sp.get('action_id') || undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  let items = fixtures.assumptions.slice();
  if (agentId) items = items.filter(a => a.agent_id === agentId);
  if (actionId) items = items.filter(a => a.action_id === actionId);

  items.sort((a, b) => (b.created_at || '').localeCompare(a.created_at || ''));
  const total = items.length;
  const paged = items.slice(offset, offset + limit);

  if (!drift) {
    return { assumptions: paged, total, lastUpdated: new Date().toISOString() };
  }

  const now = Date.now();
  let atRisk = 0;
  for (const asm of paged) {
    if (asm.validated === 1) {
      asm.drift_score = 0;
    } else if (asm.invalidated === 1) {
      asm.drift_score = null;
    } else {
      const createdAt = new Date(asm.created_at).getTime();
      const daysOld = (now - createdAt) / (1000 * 60 * 60 * 24);
      asm.drift_score = Math.min(100, Math.round((daysOld / 30) * 100));
      if (asm.drift_score >= 50) atRisk++;
    }
  }

  return {
    assumptions: paged,
    total,
    drift_summary: {
      total,
      at_risk: atRisk,
      validated: paged.filter(a => a.validated === 1).length,
      invalidated: paged.filter(a => a.invalidated === 1).length,
      unvalidated: paged.filter(a => a.validated === 0 && a.invalidated === 0).length,
    },
    lastUpdated: new Date().toISOString(),
  };
}

export function demoLearning(fixtures, url) {
  const agentId = url.searchParams.get('agent_id');
  const decisions = agentId ? fixtures.decisions.filter(d => d.agent_id === agentId) : fixtures.decisions;
  const lessons = fixtures.lessons;

  const successCount = decisions.filter(d => d.outcome === 'success').length;
  const totalWithOutcome = decisions.filter(d => d.outcome && d.outcome !== 'pending').length;
  const successRate = totalWithOutcome > 0 ? Math.round((successCount / totalWithOutcome) * 100) : 0;

  const stats = {
    totalDecisions: decisions.length,
    totalLessons: lessons.length,
    successRate,
    patterns: lessons.filter(l => (l.confidence || 0) >= 80).length,
  };

  return { decisions: decisions.slice(0, 20), lessons, stats, lastUpdated: new Date().toISOString() };
}

export function demoLearningRecommendations(fixtures, url) {
  const sp = url.searchParams;
  const agentId = sp.get('agent_id') || undefined;
  const actionType = sp.get('action_type') || undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const includeInactive = sp.get('include_inactive') === 'true';

  let recs = fixtures.recommendations.slice();
  if (agentId) recs = recs.filter(r => r.agent_id === agentId);
  if (actionType) recs = recs.filter(r => r.action_type === actionType);
  if (!includeInactive) recs = recs.filter(r => r.active);

  return {
    recommendations: recs.slice(0, limit),
    metrics: undefined,
    lookback_days: 30,
    total: Math.min(limit, recs.length),
    lastUpdated: new Date().toISOString(),
  };
}

export function demoLearningRecommendationMetrics(fixtures, url) {
  const sp = url.searchParams;
  const agentId = sp.get('agent_id') || undefined;
  const actionType = sp.get('action_type') || undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '100', 10), 200);

  let metrics = fixtures.metrics.slice();
  if (agentId) metrics = metrics.filter(m => m.agent_id === agentId);
  if (actionType) metrics = metrics.filter(m => m.action_type === actionType);

  return {
    metrics: metrics.slice(0, limit),
    summary: fixtures.metricsSummary,
    lookback_days: 30,
    lastUpdated: new Date().toISOString(),
  };
}

export function demoTokens(fixtures) {
  return {
    current: fixtures.tokensCurrent,
    today: fixtures.tokensToday,
    history: fixtures.tokenHistory.slice().reverse(),
    timeline: [],
    lastUpdated: new Date().toISOString(),
  };
}

export function demoPolicies(fixtures) {
  return { policies: fixtures.policies, lastUpdated: new Date().toISOString() };
}

export function demoGuard(fixtures, url) {
  const sp = url.searchParams;
  const agentId = sp.get('agent_id') || undefined;
  const policyId = sp.get('policy_id') || undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  let reads = (fixtures.guardReads || fixtures.guardDecisions || []).slice();
  if (agentId) reads = reads.filter(r => r.agent_id === agentId);
  if (policyId) reads = reads.filter(r => r.policy_id === policyId);

  const total = reads.length;
  const paged = reads.slice(offset, offset + limit);
  const blocks = reads.filter(r => r.decision === 'block').length;
  const stats = { total, blocks, permits: total - blocks };

  return { evaluations: paged, total, stats, lastUpdated: new Date().toISOString() };
}

export function demoMessages(fixtures, url) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const msgs = fixtures.messages.slice();
  const total = msgs.length;
  const paged = msgs.slice(offset, offset + limit);
  const agents = new Set();
  const threads = new Set();
  msgs.forEach(m => { if (m.agent_id) agents.add(m.agent_id); if (m.thread_id) threads.add(m.thread_id); });
  const stats = { total_messages: total, unique_agents: agents.size, active_threads: threads.size };
  return { messages: paged, total, stats, lastUpdated: new Date().toISOString() };
}

export function demoMessageThreads(fixtures, url) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const offset = parseInt(url.searchParams.get('offset') || '0', 10);
  const threadList = fixtures.messageThreads.slice();
  const total = threadList.length;
  const paged = threadList.slice(offset, offset + limit);
  return { threads: paged, total, lastUpdated: new Date().toISOString() };
}

export function demoMessageDocs(fixtures, url) {
  const sp = url.searchParams;
  const agentId = sp.get('agent_id') || undefined;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  let docs = fixtures.messages.filter(m => Array.isArray(m.docs) && m.docs.length > 0).flatMap(m => m.docs);
  const total = docs.length;
  const paged = docs.slice(offset, offset + limit);
  return { docs: paged, total, lastUpdated: new Date().toISOString() };
}

export function demoContent(fixtures, url) {
  const sp = url.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  const items = fixtures.contentItems.slice();
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  const docs = items.filter(i => i.type === 'document').length;
  const snippets = items.filter(i => i.type === 'snippet').length;
  const pages = items.filter(i => i.type === 'dashboard_page').length;
  const stats = { total_items: total, documents: docs, snippets, pages, storage_bytes: 4200000 };

  return { items: paged, total, stats, lastUpdated: new Date().toISOString() };
}

export function demoTeam(fixtures) {
  return { team: fixtures.team, lastUpdated: new Date().toISOString() };
}

export function demoTeamInvites(fixtures) {
  return { invites: fixtures.invites, lastUpdated: new Date().toISOString() };
}

export function demoActivity(fixtures, url) {
  const sp = url.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  const items = fixtures.activityEvents.slice();
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  return { events: paged, total, lastUpdated: new Date().toISOString() };
}

export function demoWebhooks(fixtures) {
  const items = fixtures.webhooks.slice();
  const stats = {
    total: items.length,
    active: items.filter(w => w.status === 'active').length,
    failing: items.filter(w => w.status === 'failing').length,
  };
  return { webhooks: items, stats, lastUpdated: new Date().toISOString() };
}

export function demoWebhookDeliveries(fixtures, webhookId) {
  const d = fixtures.webhookDeliveries.filter(del => del.webhook_id === webhookId);
  return { deliveries: d, total: d.length };
}

export function demoWorkflows(fixtures, url) {
  const items = fixtures.workflows.slice();
  const stats = {
    total: items.length,
    active: items.filter(w => w.status === 'active').length,
    paused: items.filter(w => w.status === 'paused').length,
  };
  return { workflows: items, stats, lastUpdated: new Date().toISOString() };
}

export function demoSchedules(fixtures) {
  return { schedules: fixtures.schedules, lastUpdated: new Date().toISOString() };
}

export function demoDigest(fixtures, url) {
  const sp = url.searchParams;
  const since = sp.get('since') || undefined;
  return { digest: fixtures.digestSummary, lastUpdated: new Date().toISOString() };
}

export function demoContextPoints(fixtures, url) {
  const sp = url.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  const items = fixtures.contextPoints.slice();
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  return { points: paged, total, lastUpdated: new Date().toISOString() };
}

export function demoContextThreads(fixtures, url) {
  const items = fixtures.contextThreads.slice();
  const active = items.filter(t => t.status === 'active').length;
  return { threads: items, total: items.length, stats: { total: items.length, active }, lastUpdated: new Date().toISOString() };
}

export function demoContextThreadDetail(fixtures, threadId) {
  const t = fixtures.contextThreads.find(th => th.id === threadId);
  if (!t) return null;
  const pts = fixtures.contextPoints.filter(p => p.thread_id === threadId);
  return { thread: t, points: pts };
}

export function demoHandoffs(fixtures, url) {
  const sp = url.searchParams;
  const limit = Math.min(parseInt(sp.get('limit') || '50', 10), 200);
  const offset = parseInt(sp.get('offset') || '0', 10);

  const items = fixtures.handoffs.slice();
  const total = items.length;
  const paged = items.slice(offset, offset + limit);
  const pending = items.filter(h => h.status === 'pending').length;
  return { handoffs: paged, total, stats: { pending }, lastUpdated: new Date().toISOString() };
}

export function demoSnippets(fixtures, url) {
  const limit = Math.min(parseInt(url.searchParams.get('limit') || '50', 10), 200);
  const items = fixtures.contentItems.filter(i => i.type === 'snippet').slice(0, limit);
  return { snippets: items, total: items.length };
}

export function demoPreferences(fixtures, url) {
  const sp = url.searchParams;
  const scope = sp.get('scope') || 'user';
  if (scope !== 'user' && scope !== 'org') return { error: 'Invalid scope' };
  return { scope, preferences: fixtures.preferences[scope] || {}, lastUpdated: new Date().toISOString() };
}

export function demoSwarmGraph(fixtures, url) {
  const nodes = [];
  const links = [];
  const agentMap = new Map();

  for (const a of fixtures.actions) {
    if (!agentMap.has(a.agent_id)) {
      agentMap.set(a.agent_id, { id: a.agent_id, group: 1, label: a.agent_name || a.agent_id, val: 1 });
    } else {
      agentMap.get(a.agent_id).val += 0.5;
    }
  }

  const interactions = [
    { source: 'agent_3', target: 'agent_2', value: 5 },
    { source: 'agent_4', target: 'agent_2', value: 3 },
    { source: 'agent_2', target: 'agent_1', value: 8 },
  ];

  for (const agent of agentMap.values()) {
    nodes.push(agent);
  }

  for (const link of interactions) {
    if (agentMap.has(link.source) && agentMap.has(link.target)) {
      links.push(link);
    }
  }

  return {
    nodes,
    links,
    total_agents: nodes.length,
    total_links: links.length,
  };
}
