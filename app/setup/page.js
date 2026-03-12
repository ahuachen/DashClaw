// app/setup/page.js
import Link from 'next/link';
import { headers } from 'next/headers';
import { getSetupStatus } from '../lib/setupStatus.mjs';
import { getAuthConfig } from '../lib/authConfig.mjs';
import { composeInstanceStatus } from './composeInstanceStatus';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Instance Status — DashClaw Setup',
};

export default async function SetupPage() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';

  const [dbStatus, authConfig] = await Promise.all([
    getSetupStatus(process.env),
    Promise.resolve(getAuthConfig(process.env)),
  ]);

  const status = composeInstanceStatus(dbStatus, authConfig);

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-16">
      <div className="max-w-2xl mx-auto">
        {/* Header */}
        <div className="mb-10">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">DashClaw</p>
          <h1 className="text-2xl font-bold tracking-tight">Instance Status</h1>
          <p className="text-sm text-zinc-500 mt-1">
            {host}
          </p>
        </div>

        {/* Status Checklist */}
        <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] divide-y divide-[rgba(255,255,255,0.06)] mb-8">
          <StatusRow
            label="Database"
            ok={status.db.ok}
            message={dbRowMessage(status.db)}
          />
          <StatusRow
            label="Sign-in"
            ok={status.auth.ok}
            warn={!status.db.ok}
            message={authRowMessage(status.auth)}
          />
        </div>

        {/* Next Action */}
        <NextAction status={status} />

        {/* Footer Links */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/self-host" className="hover:text-zinc-300 transition-colors">
            Deployment guide →
          </Link>
          {status.auth.ok && (
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Sign in →
            </Link>
          )}
          {status.overall === 'ready' && (
            <Link href="/dashboard" className="hover:text-brand transition-colors font-medium">
              Go to dashboard →
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

// --- Sub-components (server-only, defined in same file) ---

function StatusRow({ label, ok, warn = false, message }) {
  const icon = ok ? '✓' : warn ? '⚠' : '✗';
  const iconColor = ok ? 'text-emerald-400' : warn ? 'text-amber-400' : 'text-red-400';
  return (
    <div className="flex items-start gap-4 px-5 py-4">
      <span className={`text-base font-bold mt-0.5 w-4 shrink-0 ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm font-medium text-zinc-200">{label}</p>
        <p className="text-xs text-zinc-500 mt-0.5">{message}</p>
      </div>
    </div>
  );
}

function dbRowMessage(db) {
  switch (db.reason) {
    case 'missing_database_url':
      return 'DATABASE_URL is not set';
    case 'connection_error':
      return 'Cannot reach database';
    case 'no_tables':
      return `Connected — migrations not run (${db.missing.length} table${db.missing.length === 1 ? '' : 's'} missing)`;
    case 'ready':
      return 'Connected and migrated';
    default:
      return db.message || 'Unknown state';
  }
}

function authRowMessage(auth) {
  if (!auth.ok) return 'No sign-in method configured';
  return auth.methods.join(', ');
}

function NextAction({ status }) {
  const { db, auth, overall } = status;

  if (db.reason === 'missing_database_url') {
    return (
      <ActionBlock title="Set DATABASE_URL" variant="error">
        <p className="text-sm text-zinc-300 mb-3">
          No database connection string found. Add <code className="text-brand">DATABASE_URL</code> to your <code className="text-brand">.env</code> file and restart the server.
        </p>
        <CodeSnippet>{`DATABASE_URL=postgres://user:password@localhost:5432/dashclaw`}</CodeSnippet>
        <p className="text-xs text-zinc-500 mt-3">
          For Neon: use the connection string from your Neon project dashboard.
          For local Docker: use the connection string matching your <code>docker-compose.yml</code>.
        </p>
      </ActionBlock>
    );
  }

  if (db.reason === 'connection_error') {
    return (
      <ActionBlock title="Database unreachable" variant="error">
        <p className="text-sm text-zinc-300 mb-3">
          <code className="text-brand">DATABASE_URL</code> is set but the database is not responding.
          Check that your database is running and the connection string is correct.
        </p>
        <p className="text-xs text-zinc-500">Common fixes: start Docker, check hostname/port, verify credentials.</p>
        <CodeSnippet>{`# Check your DATABASE_URL
echo $DATABASE_URL

# Start local Postgres via Docker
docker compose up -d`}</CodeSnippet>
      </ActionBlock>
    );
  }

  if (db.reason === 'no_tables') {
    return (
      <ActionBlock title="Run migrations" variant="warn">
        <p className="text-sm text-zinc-300 mb-3">
          Database is reachable but core tables are missing ({db.missing.length} not found).
          Run the bootstrap migrations to create them.
        </p>
        <CodeSnippet>{`node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
node scripts/_run-with-env.mjs scripts/migrate-capabilities.mjs`}</CodeSnippet>
        <p className="text-xs text-zinc-500 mt-3">
          These are the core bootstrap migrations. Additional feature migrations may exist in <code>scripts/</code>.
          After running, reload this page.
        </p>
      </ActionBlock>
    );
  }

  if (overall === 'partial') {
    // DB is ready, auth is missing
    return (
      <ActionBlock title="Configure sign-in" variant="warn">
        <p className="text-sm text-zinc-300 mb-4">
          Database is ready. You need at least one sign-in method before the dashboard is accessible.
        </p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
            <p className="text-xs font-semibold text-zinc-200 mb-2">Solo / Local access</p>
            <p className="text-xs text-zinc-400 mb-3">Set a local admin password. No OAuth app required.</p>
            <CodeSnippet>{`DASHCLAW_LOCAL_ADMIN_PASSWORD=your-password`}</CodeSnippet>
          </div>
          <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
            <p className="text-xs font-semibold text-zinc-200 mb-2">OAuth (GitHub / Google / OIDC)</p>
            <p className="text-xs text-zinc-400 mb-3">Add credentials for your chosen provider.</p>
            <CodeSnippet>{`# GitHub
GITHUB_ID=your-client-id
GITHUB_SECRET=your-client-secret

# Google
GOOGLE_ID=your-client-id
GOOGLE_SECRET=your-client-secret`}</CodeSnippet>
          </div>
        </div>
        <p className="text-xs text-zinc-500 mt-4">After updating your .env, restart the server and reload this page.</p>
      </ActionBlock>
    );
  }

  // overall === 'ready'
  return (
    <ActionBlock title="Instance ready" variant="ready">
      <p className="text-sm text-zinc-300 mb-4">
        Database is connected and migrated. Sign-in is configured ({auth.methods.join(', ')}).
        You can sign in now.
      </p>
      <div className="flex gap-3">
        <Link
          href="/login"
          className="inline-flex items-center gap-2 rounded-lg bg-brand px-4 py-2 text-sm font-medium text-white hover:bg-brand-hover transition-colors"
        >
          Sign in
        </Link>
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] px-4 py-2 text-sm font-medium text-zinc-300 hover:text-white transition-colors"
        >
          Dashboard
        </Link>
      </div>
    </ActionBlock>
  );
}

function ActionBlock({ title, variant, children }) {
  const borderColor = {
    error: 'border-red-900/50',
    warn: 'border-amber-900/50',
    ready: 'border-emerald-900/40',
  }[variant] || 'border-[rgba(255,255,255,0.08)]';

  const titleColor = {
    error: 'text-red-400',
    warn: 'text-amber-400',
    ready: 'text-emerald-400',
  }[variant] || 'text-zinc-200';

  return (
    <div className={`rounded-xl border bg-[#111] p-5 ${borderColor}`}>
      <p className={`text-sm font-semibold mb-3 ${titleColor}`}>{title}</p>
      {children}
    </div>
  );
}

function CodeSnippet({ children }) {
  return (
    <pre className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}
