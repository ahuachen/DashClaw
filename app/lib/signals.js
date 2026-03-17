/**
 * Shared signal computation. Extracted from /api/actions/signals/route.js
 * Used by both the API route and the cron job.
 */

/**
 * Compute all 7 risk signal types for an org.
 *
 * @param {string} orgId
 * @param {string|null} filterAgentId - optional agent filter
 * @param {Function} sql - neon sql tagged template
 * @returns {Promise<Array>} signals array
 */
export async function computeSignals(orgId, filterAgentId, sql) {
  const [autonomySpikes, highImpact, repeatedFailures, staleLoops, assumptionDrift, staleAssumptions, staleRunning, stalePresence] = await Promise.all([
    sql`
      SELECT agent_id, agent_name, COUNT(*) as action_count
      FROM action_records
      WHERE timestamp_start::timestamptz > NOW() - INTERVAL '1 hour'
        AND org_id = ${orgId}
      GROUP BY agent_id, agent_name
      HAVING COUNT(*) > 10
      ORDER BY action_count DESC
    `,
    sql`
      SELECT action_id, agent_id, agent_name, declared_goal, risk_score, action_type
      FROM action_records
      WHERE reversible = 0
        AND org_id = ${orgId}
        AND risk_score >= 70
        AND (authorization_scope IS NULL OR authorization_scope = '')
        AND status = 'running'
      ORDER BY risk_score DESC
      LIMIT 10
    `,
    sql`
      SELECT agent_id, agent_name, COUNT(*) as failure_count
      FROM action_records
      WHERE status = 'failed'
        AND org_id = ${orgId}
        AND timestamp_start::timestamptz > NOW() - INTERVAL '24 hours'
      GROUP BY agent_id, agent_name
      HAVING COUNT(*) > 3
      ORDER BY failure_count DESC
    `,
    sql`
      SELECT ol.loop_id, ol.description, ol.priority, ol.loop_type, ol.created_at,
             ar.agent_id, ar.agent_name, ar.declared_goal
      FROM open_loops ol
      LEFT JOIN action_records ar ON ol.action_id = ar.action_id
      WHERE ol.status = 'open'
        AND ol.org_id = ${orgId}
        AND ol.created_at < NOW() - INTERVAL '48 hours'
      ORDER BY ol.created_at ASC
      LIMIT 10
    `,
    sql`
      SELECT ar.agent_id, ar.agent_name, COUNT(*) as invalidation_count
      FROM assumptions a
      LEFT JOIN action_records ar ON a.action_id = ar.action_id
      WHERE a.invalidated = 1
        AND a.org_id = ${orgId}
        AND a.invalidated_at IS NOT NULL
        AND a.invalidated_at::timestamptz > NOW() - INTERVAL '7 days'
      GROUP BY ar.agent_id, ar.agent_name
      HAVING COUNT(*) >= 2
      ORDER BY invalidation_count DESC
    `,
    sql`
      SELECT a.assumption_id, a.assumption, a.created_at, a.action_id,
             ar.agent_id, ar.agent_name
      FROM assumptions a
      LEFT JOIN action_records ar ON a.action_id = ar.action_id
      WHERE a.validated = 0
        AND a.org_id = ${orgId}
        AND a.invalidated = 0
        AND a.created_at < NOW() - INTERVAL '14 days'
      ORDER BY a.created_at ASC
      LIMIT 10
    `,
    sql`
      SELECT action_id, agent_id, agent_name, declared_goal, timestamp_start, risk_score
      FROM action_records
      WHERE status = 'running'
        AND org_id = ${orgId}
        AND timestamp_start::timestamptz < NOW() - INTERVAL '4 hours'
      ORDER BY timestamp_start ASC
      LIMIT 10
    `,
    // Check for stale heartbeats (silent for > 10 mins)
    sql`
      SELECT agent_id, agent_name, last_heartbeat_at, current_task_id, status
      FROM agent_presence
      WHERE org_id = ${orgId}
        AND last_heartbeat_at::timestamptz < NOW() - INTERVAL '10 minutes'
        AND (status != 'offline' OR current_task_id IS NOT NULL)
      LIMIT 10
    `
  ]);

  const signals = [];

  for (const presence of stalePresence) {
    signals.push({
      type: 'agent_silent',
      severity: presence.current_task_id ? 'red' : 'amber',
      label: `Agent heartbeat lost: ${presence.agent_name || presence.agent_id}`,
      detail: `This agent has not sent a heartbeat for over 10 minutes. Last heartbeat: ${new Date(presence.last_heartbeat_at).toLocaleString()}.`,
      help: presence.current_task_id 
        ? 'Agent is silent while assigned to an active task. Investigate potential process crash or network failure.'
        : 'Agent heartbeat lost. It may be offline or unable to reach the dashboard.',
      agent_id: presence.agent_id
    });
  }

  for (const spike of autonomySpikes) {
    signals.push({
      type: 'autonomy_spike',
      severity: parseInt(spike.action_count, 10) > 20 ? 'red' : 'amber',
      label: `Governance alert: ${spike.agent_name || spike.agent_id} (${spike.action_count} ungoverned decisions/hr)`,
      detail: `This agent made ${spike.action_count} decisions in the last hour without proportional oversight, exceeding the governance threshold of 10.`,
      help: 'High decision frequency without oversight may indicate ungoverned autonomy. Review recent decisions and enforce policy throttling.',
      agent_id: spike.agent_id
    });
  }

  for (const action of highImpact) {
    signals.push({
      type: 'high_impact_low_oversight',
      severity: parseInt(action.risk_score, 10) >= 90 ? 'red' : 'amber',
      label: `Ungoverned high-risk decision: ${action.declared_goal?.substring(0, 50) || 'Unknown'}`,
      detail: `${action.agent_name || action.agent_id} is executing an irreversible decision (risk: ${action.risk_score}) without governance authorization.`,
      help: 'High-risk irreversible decisions must have explicit authorization_scope. Enforce policy compliance before execution.',
      agent_id: action.agent_id,
      action_id: action.action_id
    });
  }

  for (const fail of repeatedFailures) {
    signals.push({
      type: 'repeated_failures',
      severity: parseInt(fail.failure_count, 10) > 5 ? 'red' : 'amber',
      label: `Decision reliability degraded: ${fail.agent_name || fail.agent_id} (${fail.failure_count} failures in 24h)`,
      detail: `This agent's decision reliability has degraded with ${fail.failure_count} failures in the last 24 hours, exceeding the integrity threshold of 3.`,
      help: 'Repeated decision failures indicate degraded reliability. Review decision rationale and underlying assumptions.',
      agent_id: fail.agent_id
    });
  }

  for (const loop of staleLoops) {
    const hoursOld = Math.round((Date.now() - new Date(loop.created_at).getTime()) / (1000 * 60 * 60));
    signals.push({
      type: 'stale_loop',
      severity: hoursOld > 96 ? 'red' : 'amber',
      label: `Unresolved dependency (${hoursOld}h): ${loop.description?.substring(0, 50) || 'Unknown'}`,
      detail: `Unresolved dependency for ${loop.agent_name || loop.agent_id || 'unknown agent'} has been blocking decision completion for ${hoursOld} hours.`,
      help: 'Unresolved dependencies weaken decision integrity. Resolve or cancel to restore the governance chain.',
      agent_id: loop.agent_id,
      loop_id: loop.loop_id
    });
  }

  for (const drift of assumptionDrift) {
    signals.push({
      type: 'assumption_drift',
      severity: parseInt(drift.invalidation_count, 10) >= 4 ? 'red' : 'amber',
      label: `Decision basis degrading: ${drift.agent_name || drift.agent_id} (${drift.invalidation_count} assumptions invalidated)`,
      detail: `${drift.invalidation_count} assumptions invalidated in the last 7 days, indicating the decision basis for this agent is eroding.`,
      help: 'Frequent assumption invalidations degrade the decision basis. Review and re-validate the foundational assumptions.',
      agent_id: drift.agent_id
    });
  }

  for (const asm of staleAssumptions) {
    const daysOld = Math.round((Date.now() - new Date(asm.created_at).getTime()) / (1000 * 60 * 60 * 24));
    signals.push({
      type: 'stale_assumption',
      severity: daysOld > 30 ? 'red' : 'amber',
      label: `Unverified decision basis (${daysOld}d): ${asm.assumption?.substring(0, 50) || 'Unknown'}`,
      detail: `This assumption has not been verified for ${daysOld} days and may no longer support sound decisions.`,
      help: 'Unverified assumptions weaken the decision basis. Validate or invalidate to maintain decision integrity.',
      agent_id: asm.agent_id,
      assumption_id: asm.assumption_id
    });
  }

  for (const action of staleRunning) {
    const hoursRunning = Math.round((Date.now() - new Date(action.timestamp_start).getTime()) / (1000 * 60 * 60));
    signals.push({
      type: 'stale_running_action',
      severity: hoursRunning > 24 ? 'red' : 'amber',
      label: `Stalled decision (${hoursRunning}h): ${action.declared_goal?.substring(0, 60) || 'Unknown goal'}`,
      detail: `${action.agent_name || action.agent_id} has had this decision executing for ${hoursRunning} hours without resolution. The governance record is incomplete.`,
      help: 'Stalled decisions leave the audit trail incomplete. Investigate whether the decision is stuck or should be finalized.',
      agent_id: action.agent_id,
      action_id: action.action_id
    });
  }

  // Integration mismatch: agent reports using a provider but credentials are missing or broken
  try {
    const [connections, health] = await Promise.all([
      sql`SELECT DISTINCT provider, agent_id FROM agent_connections WHERE org_id = ${orgId} AND status = 'active'`,
      sql`SELECT provider, status FROM integration_health WHERE org_id = ${orgId}`,
    ]);
    const healthMap = Object.fromEntries(health.map(h => [h.provider, h.status]));
    for (const conn of connections) {
      const h = healthMap[conn.provider];
      if (h === 'error') {
        signals.push({
          type: 'integration_mismatch',
          severity: 'red',
          label: 'Integration Credential Error',
          detail: `Agent "${conn.agent_id}" reports using ${conn.provider} but stored credentials are invalid.`,
          help: 'Update credentials on the Integrations page.',
          agent_id: conn.agent_id,
        });
      } else if (!h && h !== 'healthy' && h !== 'degraded') {
        // No health record means credentials were never configured or checked
        const hasAnyHealth = health.length > 0; // health cron has run at least once
        if (hasAnyHealth) {
          signals.push({
            type: 'integration_mismatch',
            severity: 'amber',
            label: 'Missing Integration Credentials',
            detail: `Agent "${conn.agent_id}" reports using ${conn.provider} but no credentials are configured.`,
            help: 'Configure credentials on the Integrations page.',
            agent_id: conn.agent_id,
          });
        }
      }
    }
  } catch {
    // integration_health table may not exist yet — skip silently
  }

  // Post-filter by agent_id if requested
  const filteredSignals = filterAgentId
    ? signals.filter(s => s.agent_id === filterAgentId)
    : signals;

  // Sort: red first, then amber
  filteredSignals.sort((a, b) => {
    if (a.severity === 'red' && b.severity !== 'red') return -1;
    if (a.severity !== 'red' && b.severity === 'red') return 1;
    return 0;
  });

  return filteredSignals;
}
