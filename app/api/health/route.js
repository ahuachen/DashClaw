import { NextResponse } from 'next/server';
import { getSql } from '../../lib/db.js';
import { isEmbeddingsEnabled } from '../../lib/embeddings.js';
import { getRealtimeHealth } from '../../lib/events.js';
import { createRequire } from 'module';

const require = createRequire(import.meta.url);
const { version } = require('../../../package.json');

/**
 * Health check endpoint for DashClaw
 * Returns system health status for monitoring
 */
export async function GET() {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version,
    checks: {}
  };

  // ... rest of checks ...
  health.checks.behavioral_ai = {
    active: isEmbeddingsEnabled(),
    engine: 'openai/text-embedding-3-small'
  };

  // Check database connection and core table existence
  try {
    const sql = getSql();
    const coreTables = ['action_records', 'guard_decisions', 'api_keys', 'org_members'];
    const tableCheck = await sql`
      SELECT table_name FROM information_schema.tables
      WHERE table_schema = 'public' AND table_name = ANY(${coreTables})
    `;
    const foundTables = tableCheck.map(r => r.table_name);
    const missingTables = coreTables.filter(t => !foundTables.includes(t));
    if (missingTables.length > 0) {
      health.status = 'degraded';
      health.checks.database = { status: 'degraded', missing_tables: missingTables.length };
    } else {
      health.checks.database = { status: 'healthy' };
    }
  } catch (error) {
    health.status = 'degraded';
    // SECURITY: avoid leaking backend error details on a public endpoint.
    health.checks.database = { status: 'unhealthy' };
  }

  // Check runtime capabilities
  health.checks.runtime = {
    edge_compatible: typeof crypto !== 'undefined' && !!crypto.subtle,
    node_env: process.env.NODE_ENV || 'development'
  };

  // Check realtime backend health and cutover readiness
  try {
    const realtime = await getRealtimeHealth();
    health.checks.realtime = realtime;
    if (realtime.status === 'unhealthy') {
      health.status = 'degraded';
    }
  } catch (error) {
    health.status = 'degraded';
    // SECURITY: avoid leaking backend error details on a public endpoint.
    health.checks.realtime = { status: 'unhealthy' };
  }

  // Check environment variables
  const requiredEnvVars = ['DATABASE_URL', 'NEXTAUTH_SECRET'];
  const missingVars = requiredEnvVars.filter(v => !process.env[v]);

  if (missingVars.length > 0) {
    health.status = 'degraded';
    health.checks.environment = {
      status: 'unhealthy',
      missing: missingVars.length
    };
  } else {
    health.checks.environment = { status: 'healthy' };
  }

  // SECURITY: Don't expose auth configuration status to public endpoint

  const statusCode = health.status === 'healthy' ? 200 : 503;
  return NextResponse.json(health, { status: statusCode });
}
