function toInt(value) {
  return parseInt(value || '0', 10);
}

function deriveStatus(capabilityHealthStatus, stats) {
  const total = toInt(stats.total_invocations);
  const successful = toInt(stats.successful_invocations);
  const failed = toInt(stats.failed_invocations);
  const pending = toInt(stats.pending_approvals);

  if (total === 0) {
    return capabilityHealthStatus && capabilityHealthStatus !== 'unknown'
      ? capabilityHealthStatus
      : 'untested';
  }

  if (failed > 0 && successful === 0) {
    return 'failing';
  }

  if (failed > 0 || pending > 0) {
    return 'degraded';
  }

  return 'healthy';
}

export async function getCapabilityHealthSummary(sql, orgId, capability) {
  const systemsTouched = JSON.stringify([`capability:${capability.slug}`]);
  const [statsRows, errorRows] = await Promise.all([
    sql`
      SELECT
        COUNT(*)::int as total_invocations,
        COUNT(*) FILTER (WHERE status = 'completed')::int as successful_invocations,
        COUNT(*) FILTER (WHERE status = 'failed')::int as failed_invocations,
        COUNT(*) FILTER (WHERE status = 'pending_approval')::int as pending_approvals,
        MAX(CASE WHEN status = 'completed' THEN timestamp_start END) as last_success_at,
        MAX(CASE WHEN status = 'failed' THEN timestamp_start END) as last_failure_at
      FROM action_records
      WHERE org_id = ${orgId}
        AND action_type = 'capability_invoke'
        AND systems_touched = ${systemsTouched}
        AND timestamp_start >= NOW() - INTERVAL '7 days'
    `,
    sql`
      SELECT error_message, timestamp_start
      FROM action_records
      WHERE org_id = ${orgId}
        AND action_type = 'capability_invoke'
        AND systems_touched = ${systemsTouched}
        AND status = 'failed'
        AND error_message IS NOT NULL
      ORDER BY timestamp_start DESC
      LIMIT 5
    `,
  ]);

  const stats = statsRows[0] || {};
  const totalInvocations = toInt(stats.total_invocations);
  const successfulInvocations = toInt(stats.successful_invocations);
  const failedInvocations = toInt(stats.failed_invocations);
  const pendingApprovals = toInt(stats.pending_approvals);

  return {
    status: deriveStatus(capability.health_status, stats),
    last_checked_at: new Date().toISOString(),
    last_success_at: stats.last_success_at || null,
    last_failure_at: stats.last_failure_at || null,
    total_invocations: totalInvocations,
    successful_invocations: successfulInvocations,
    failed_invocations: failedInvocations,
    pending_approvals: pendingApprovals,
    success_rate_7d: totalInvocations > 0
      ? Math.round((successfulInvocations / totalInvocations) * 100)
      : 0,
    recent_errors: errorRows.map((row) => ({
      message: row.error_message,
      timestamp: row.timestamp_start,
    })),
  };
}
