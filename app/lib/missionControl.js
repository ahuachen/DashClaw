const STATUS_LABELS = {
  completed: 'Completed',
  failed: 'Failed',
  running: 'Running',
  'in-progress': 'Running',
  pending: 'Pending',
  pending_approval: 'Awaiting approval',
  resolved: 'Resolved',
  cancelled: 'Cancelled',
  allow: 'Allowed',
  warn: 'Warned',
  block: 'Blocked',
  require_approval: 'Approval required',
  open: 'Open',
};

function titleCase(value) {
  return String(value || 'unknown')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (match) => match.toUpperCase());
}

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function formatMissionStatus(status) {
  return STATUS_LABELS[status] || titleCase(status);
}

export function isRoutineMonitorAction(action) {
  const actionType = action?.action_type || action?.actionType;
  const risk = asNumber(action?.risk_score ?? action?.riskScore, 0);
  const status = action?.status;
  return actionType === 'monitor' && risk < 70 && !['failed', 'pending_approval'].includes(status);
}

export function buildActionEvent(action) {
  const status = action.status === 'in-progress' ? 'running' : action.status;
  const riskScore = asNumber(action.risk_score ?? action.riskScore, null);
  const confidence = asNumber(action.confidence, null);
  const isMonitor = isRoutineMonitorAction({ ...action, status, risk_score: riskScore });
  const summary = action.output_summary || action.error_message || action.input_summary || null;

  let emphasis = 60;
  if (status === 'failed') emphasis = 100;
  else if (status === 'pending_approval') emphasis = 95;
  else if (riskScore >= 85) emphasis = 92;
  else if (status === 'running') emphasis = isMonitor ? 24 : 70;
  else if (status === 'completed') emphasis = isMonitor ? 22 : 66;
  else if (isMonitor) emphasis = 20;

  return {
    id: `action:${action.action_id}`,
    entityId: action.action_id,
    entityType: 'action',
    category: isMonitor ? 'telemetry' : 'decision',
    actionType: action.action_type || 'other',
    title: action.declared_goal || titleCase(action.action_type || 'action'),
    goal: action.declared_goal || null,
    agentId: action.agent_id || null,
    agentName: action.agent_name || action.agent_id || null,
    status,
    statusLabel: formatMissionStatus(status),
    outputSummary: summary,
    riskScore,
    confidence,
    startedAt: action.timestamp_start || action.created_at || null,
    endedAt: action.timestamp_end || null,
    timestamp: action.timestamp_end || action.timestamp_start || action.created_at || new Date().toISOString(),
    parentActionId: action.parent_action_id || null,
    lowSignal: isMonitor,
    emphasis,
  };
}

export function buildLoopEvent(loop) {
  const priority = loop.priority || 'medium';
  const loopType = loop.loop_type || 'loop';
  const isApproval = loopType === 'approval';
  const emphasis =
    priority === 'critical' ? 98 :
    priority === 'high' ? 90 :
    isApproval ? 82 : 74;

  return {
    id: `loop:${loop.loop_id}`,
    entityId: loop.loop_id,
    entityType: 'loop',
    category: 'intervention',
    actionId: loop.action_id || null,
    actionType: loop.action_type || null,
    title: loop.description || `${titleCase(loopType)} intervention`,
    goal: loop.declared_goal || null,
    agentId: loop.agent_id || null,
    agentName: loop.agent_name || loop.agent_id || null,
    status: loop.status || 'open',
    statusLabel: formatMissionStatus(loop.status || 'open'),
    priority,
    outputSummary: loop.resolution || null,
    timestamp: loop.resolved_at || loop.created_at || new Date().toISOString(),
    startedAt: loop.created_at || null,
    endedAt: loop.resolved_at || null,
    loopType,
    lowSignal: false,
    emphasis,
  };
}

export function buildGuardEvent(decision) {
  const status = decision.decision || 'allow';
  const riskScore = asNumber(decision.risk_score, null);
  const lowSignal = status === 'allow' && riskScore < 70;
  const emphasis =
    status === 'block' ? 100 :
    status === 'require_approval' ? 96 :
    status === 'warn' ? 82 :
    lowSignal ? 18 : 54;

  return {
    id: `guard:${decision.id}`,
    entityId: decision.id,
    entityType: 'guard',
    category: lowSignal ? 'telemetry' : 'governance',
    actionType: decision.action_type || 'other',
    title:
      status === 'block' ? 'Blocked by policy' :
      status === 'require_approval' ? 'Awaiting human approval' :
      status === 'warn' ? 'Guard raised warning' :
      'Guard cleared action',
    goal: decision.action_type ? `${titleCase(decision.action_type)} decision` : null,
    agentId: decision.agent_id || null,
    agentName: decision.agent_name || decision.agent_id || null,
    status,
    statusLabel: formatMissionStatus(status),
    riskScore,
    outputSummary: decision.reason || null,
    timestamp: decision.created_at || new Date().toISOString(),
    startedAt: decision.created_at || null,
    lowSignal,
    emphasis,
  };
}

export function buildLearningEvent(decision) {
  return {
    id: `learning:${decision.id || decision.timestamp || Math.random().toString(36).slice(2, 8)}`,
    entityId: decision.id || null,
    entityType: 'learning',
    category: 'outcome',
    title: decision.decision || 'Decision note',
    goal: null,
    agentId: decision.agent_id || null,
    agentName: decision.agent_name || decision.agent_id || null,
    status: decision.outcome || 'pending',
    statusLabel: formatMissionStatus(decision.outcome || 'pending'),
    confidence: asNumber(decision.confidence, null),
    outputSummary: decision.context || decision.reasoning || null,
    timestamp: decision.timestamp || decision.created_at || new Date().toISOString(),
    startedAt: decision.timestamp || decision.created_at || null,
    lowSignal: false,
    emphasis: decision.outcome === 'failure' ? 86 : 58,
  };
}

export function collapseRoutineTelemetry(events, { windowMs = 90 * 60 * 1000 } = {}) {
  const sorted = [...events].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const output = [];
  const groups = new Map();

  for (const event of sorted) {
    if (!event.lowSignal) {
      output.push(event);
      continue;
    }

    const key = [
      event.category,
      event.actionType || 'other',
      event.goal || event.title,
      event.agentId || 'unknown',
      event.status || 'unknown',
    ].join('|');
    const ts = new Date(event.timestamp).getTime();
    const existing = groups.get(key);

    if (existing && Math.abs(existing.latestTs - ts) <= windowMs) {
      existing.count += 1;
      existing.latestTs = Math.max(existing.latestTs, ts);
      existing.earliestTs = Math.min(existing.earliestTs, ts);
      if (!existing.outputSummary && event.outputSummary) existing.outputSummary = event.outputSummary;
      continue;
    }

    const aggregate = {
      ...event,
      id: `telemetry:${key}:${ts}`,
      entityType: 'telemetry_group',
      aggregate: true,
      count: 1,
      earliestTs: ts,
      latestTs: ts,
      title: event.actionType === 'monitor' ? 'Routine monitor checks' : 'Routine telemetry',
      outputSummary: event.outputSummary || null,
    };
    groups.set(key, aggregate);
    output.push(aggregate);
  }

  return output
    .map((item) => {
      if (!item.aggregate) return item;
      const windowMinutes = Math.max(1, Math.round((item.latestTs - item.earliestTs) / 60000));
      return {
        ...item,
        timestamp: new Date(item.latestTs).toISOString(),
        outputSummary:
          item.count > 1
            ? `${item.count} low-signal updates collapsed into one row over ${windowMinutes}m.`
            : item.outputSummary || 'Routine telemetry update.',
      };
    })
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
}

export function buildOperatorBrief({ actions = [], loops = [], guardDecisions = [] }) {
  const normalizedActions = actions.map(buildActionEvent);
  const normalizedLoops = loops.map(buildLoopEvent);
  const normalizedGuards = guardDecisions.map(buildGuardEvent);

  const needsAttention = [
    ...normalizedActions.filter((event) => ['failed', 'pending_approval'].includes(event.status) || (event.riskScore ?? 0) >= 85),
    ...normalizedLoops.filter((event) => ['critical', 'high'].includes(event.priority) && event.status === 'open'),
    ...normalizedGuards.filter((event) => ['block', 'require_approval', 'warn'].includes(event.status)),
  ]
    .sort((a, b) => b.emphasis - a.emphasis || new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 4);

  const running = normalizedActions
    .filter((event) => ['running', 'pending', 'pending_approval'].includes(event.status) && !event.lowSignal)
    .sort((a, b) => new Date(b.startedAt || b.timestamp) - new Date(a.startedAt || a.timestamp))
    .slice(0, 4);

  const recentOutcomes = normalizedActions
    .filter((event) => ['completed', 'failed'].includes(event.status) && !event.lowSignal)
    .sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 4);

  const interventions = [
    ...normalizedGuards.filter((event) => ['block', 'require_approval', 'warn'].includes(event.status)),
    ...normalizedLoops.filter((event) => event.status === 'open'),
  ]
    .sort((a, b) => b.emphasis - a.emphasis || new Date(b.timestamp) - new Date(a.timestamp))
    .slice(0, 4);

  return { needsAttention, running, recentOutcomes, interventions };
}
