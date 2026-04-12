// app/lib/doctor/checks/database.mjs
import { getSetupStatus } from '../../setupStatus.mjs';

/**
 * @param {{ env?: object }} options
 */
export async function runChecks({ env = process.env } = {}) {
  const dbStatus = await getSetupStatus(env);
  const checks = [];

  if (dbStatus.configured) {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'pass',
      title: 'Database Connection',
      message: 'Connected to Postgres',
      fix: null,
    });
    checks.push({
      id: 'db_schema',
      category: 'database',
      status: 'pass',
      title: 'Core Tables',
      message: 'All core tables present',
      fix: null,
    });
  } else if (dbStatus.reason === 'missing_database_url') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'fail',
      title: 'Database Connection',
      message: 'DATABASE_URL is not set',
      fix: null,
    });
  } else if (dbStatus.reason === 'connection_error') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'fail',
      title: 'Database Connection',
      message: 'Unable to connect to database — check DATABASE_URL and ensure Postgres is running',
      fix: null,
    });
  } else if (dbStatus.reason === 'no_tables') {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'pass',
      title: 'Database Connection',
      message: 'Connected to Postgres',
      fix: null,
    });
    const missing = dbStatus.missing || [];
    checks.push({
      id: 'db_schema',
      category: 'database',
      status: 'fail',
      title: 'Core Tables',
      message: `Missing ${missing.length} core table(s): ${missing.join(', ')}`,
      fix: {
        type: 'auto',
        description: 'Run database migrations to create missing tables',
        action: 'migrate',
      },
    });
  } else {
    checks.push({
      id: 'db_connection',
      category: 'database',
      status: 'fail',
      title: 'Database Connection',
      message: dbStatus.message || 'Database verification failed for an unknown reason',
      fix: null,
    });
  }

  return checks;
}
