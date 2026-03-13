// app/setup/page.js
import Link from 'next/link';
import { headers } from 'next/headers';
import { getReadinessReport } from '../lib/readiness.mjs';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Setup & Verify — DashClaw',
};

export default async function SetupPage() {
  const headersList = await headers();
  const host = headersList.get('host') || 'localhost';

  const report = await getReadinessReport(process.env);
  const { overall, checkedAt, db, config, auth } = report;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white px-6 py-12">
      <div className="max-w-2xl mx-auto">

        {/* Page header */}
        <div className="mb-8">
          <p className="text-xs text-zinc-500 uppercase tracking-widest mb-2">DashClaw</p>
          <h1 className="text-2xl font-bold tracking-tight">Setup & Verify</h1>
          <p className="text-sm text-zinc-500 mt-1">{host}</p>
        </div>

        {/* Overall status banner */}
        <OverallBanner overall={overall} checkedAt={checkedAt} />

        {/* Readiness sections */}
        <div className="space-y-4 mt-6">

          {/* 1. Application */}
          <ReadinessSection
            title="Application"
            status="pass"
            description="Verifies the app is running and reports runtime context."
          >
            <CheckRow status="pass" label="App reachable" detail="Page rendered successfully" />
            <CheckRow
              status="pass"
              label="Runtime"
              detail={`Node.js ${process.version} · ${process.env.NODE_ENV || 'development'}`}
            />
          </ReadinessSection>

          {/* 2. Database */}
          <ReadinessSection
            title="Database"
            status={db.ok ? 'pass' : 'fail'}
            description="Checks database connectivity and verifies all required tables exist."
          >
            <DatabaseSection db={db} />
          </ReadinessSection>

          {/* 3. Configuration */}
          <ReadinessSection
            title="Configuration"
            status={!config.ok ? 'fail' : config.missingAdvisory.length > 0 ? 'warn' : 'pass'}
            description="Verifies required and recommended environment variables are set."
          >
            <ConfigSection config={config} />
          </ReadinessSection>

          {/* 4. Authentication & API Access */}
          <ReadinessSection
            title="Authentication & API Access"
            status={auth.ok ? 'pass' : 'warn'}
            description="Confirms a sign-in method is configured and explains the API key flow."
          >
            <AuthSection auth={auth} />
          </ReadinessSection>

          {/* 5. SDK & Integration Verification */}
          <ReadinessSection
            title="SDK & Integration Verification"
            status="info"
            description="Commands to verify your DashClaw integration from an agent or tool."
          >
            <SdkSection />
          </ReadinessSection>

        </div>

        {/* Recommended next steps */}
        <RecommendedSteps report={report} />

        {/* Footer links */}
        <div className="mt-10 flex flex-wrap gap-4 text-sm text-zinc-500">
          <Link href="/self-host" className="hover:text-zinc-300 transition-colors">
            Deployment guide →
          </Link>
          <Link href="/docs" className="hover:text-zinc-300 transition-colors">
            API docs →
          </Link>
          {auth.ok && (
            <Link href="/login" className="hover:text-zinc-300 transition-colors">
              Sign in →
            </Link>
          )}
          {overall === 'healthy' && (
            <Link href="/dashboard" className="hover:text-brand transition-colors font-medium">
              Go to dashboard →
            </Link>
          )}
        </div>

      </div>
    </div>
  );
}

// --- Overall status banner ---

function OverallBanner({ overall, checkedAt }) {
  const config = {
    healthy: {
      label: 'Healthy',
      summary: 'All required checks pass. This instance is ready to use.',
      dot: 'bg-emerald-400',
      border: 'border-emerald-900/40',
      text: 'text-emerald-400',
    },
    needs_attention: {
      label: 'Needs Attention',
      summary: 'Core checks pass but some configuration is incomplete.',
      dot: 'bg-amber-400',
      border: 'border-amber-900/40',
      text: 'text-amber-400',
    },
    blocked: {
      label: 'Blocked',
      summary: 'One or more required checks failed. See details below.',
      dot: 'bg-red-400',
      border: 'border-red-900/50',
      text: 'text-red-400',
    },
  }[overall] || {
    label: 'Unknown',
    summary: 'Could not determine instance status.',
    dot: 'bg-zinc-400',
    border: 'border-zinc-700',
    text: 'text-zinc-400',
  };

  const ts = checkedAt
    ? new Date(checkedAt).toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
    : null;

  return (
    <div className={`rounded-xl border bg-[#111] px-5 py-4 ${config.border}`}>
      <div className="flex items-center gap-3">
        <span className={`w-2.5 h-2.5 rounded-full shrink-0 ${config.dot}`} />
        <div>
          <p className={`text-sm font-semibold ${config.text}`}>{config.label}</p>
          <p className="text-xs text-zinc-500 mt-0.5">{config.summary}</p>
        </div>
      </div>
      {ts && (
        <p className="text-[10px] text-zinc-600 mt-3">
          Checked at {ts} (server time) ·{' '}
          <a href="/setup" className="hover:text-zinc-400 transition-colors underline underline-offset-2">
            Reload
          </a>
        </p>
      )}
    </div>
  );
}

// --- Section wrapper ---

function ReadinessSection({ title, status, description, children }) {
  const headerColor = {
    pass: 'text-emerald-400',
    fail: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-400',
  }[status] || 'text-zinc-400';

  const icon = { pass: '✓', fail: '✗', warn: '⚠', info: '·' }[status] || '·';

  return (
    <div className="rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] overflow-hidden">
      <div className="px-5 py-3 border-b border-[rgba(255,255,255,0.06)] flex items-center gap-2.5">
        <span className={`text-sm font-bold ${headerColor}`}>{icon}</span>
        <div>
          <p className="text-sm font-semibold text-zinc-200">{title}</p>
          {description && <p className="text-[11px] text-zinc-500 mt-0.5">{description}</p>}
        </div>
      </div>
      <div className="divide-y divide-[rgba(255,255,255,0.04)]">
        {children}
      </div>
    </div>
  );
}

// --- Check row ---

function CheckRow({ status, label, detail, subDetail }) {
  const icon = { pass: '✓', fail: '✗', warn: '⚠', info: '·' }[status] || '·';
  const iconColor = {
    pass: 'text-emerald-400',
    fail: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-500',
  }[status] || 'text-zinc-500';

  return (
    <div className="flex items-start gap-3 px-5 py-3">
      <span className={`text-xs font-bold mt-0.5 w-3 shrink-0 ${iconColor}`}>{icon}</span>
      <div className="min-w-0">
        <p className="text-sm text-zinc-200">{label}</p>
        {detail && <p className="text-xs text-zinc-500 mt-0.5">{detail}</p>}
        {subDetail && <p className="text-xs text-zinc-600 mt-0.5">{subDetail}</p>}
      </div>
    </div>
  );
}

// --- Database section ---

function DatabaseSection({ db }) {
  if (db.reason === 'missing_database_url') {
    return (
      <>
        <CheckRow status="fail" label="DATABASE_URL" detail="Not set — database connection cannot be established" />
        <CheckRow status="info" label="Tables" detail="Cannot check — no database connection" />
      </>
    );
  }

  if (db.reason === 'connection_error') {
    return (
      <>
        <CheckRow status="warn" label="DATABASE_URL" detail="Set, but database is not responding" />
        <CheckRow status="fail" label="Connection" detail="Could not reach the database — check hostname, port, and credentials" />
        <CheckRow status="info" label="Tables" detail="Cannot check — connection failed" />
      </>
    );
  }

  if (db.reason === 'no_tables') {
    const presentCount = db.allTables.length - db.missing.length;
    return (
      <>
        <CheckRow status="pass" label="DATABASE_URL" detail="Configured" />
        <CheckRow status="pass" label="Connection" detail="Database is reachable" />
        <CheckRow
          status="fail"
          label="Core tables"
          detail={`${presentCount} of ${db.allTables.length} tables present — ${db.missing.length} missing`}
          subDetail={`Missing: ${db.missing.join(', ')}`}
        />
      </>
    );
  }

  // Ready
  return (
    <>
      <CheckRow status="pass" label="DATABASE_URL" detail="Configured" />
      <CheckRow status="pass" label="Connection" detail="Database is reachable" />
      <CheckRow
        status="pass"
        label="Core tables"
        detail={`All ${db.allTables.length} required tables present`}
        subDetail={db.allTables.join(', ')}
      />
    </>
  );
}

// --- Configuration section ---

function ConfigSection({ config }) {
  return config.vars.map((v) => {
    let status;
    if (v.present) {
      status = 'pass';
    } else if (v.required) {
      status = 'fail';
    } else {
      status = 'warn';
    }

    return (
      <CheckRow
        key={v.key}
        status={status}
        label={v.key}
        detail={v.present ? v.description : `${v.required ? 'Required' : 'Recommended'} — ${v.help}`}
      />
    );
  });
}

// --- Auth section ---

function AuthSection({ auth }) {
  const { config } = auth;

  return (
    <>
      {auth.ok ? (
        <CheckRow
          status="pass"
          label="Sign-in method"
          detail={auth.methods.join(', ')}
        />
      ) : (
        <CheckRow
          status="warn"
          label="Sign-in method"
          detail="No sign-in method configured — dashboard will be inaccessible"
          subDetail="Add DASHCLAW_LOCAL_ADMIN_PASSWORD for solo access, or configure GitHub/Google/OIDC OAuth"
        />
      )}

      {config.hasGitHub && <CheckRow status="pass" label="GitHub OAuth" detail="GITHUB_ID + GITHUB_SECRET configured" />}
      {config.hasGoogle && <CheckRow status="pass" label="Google OAuth" detail="GOOGLE_ID + GOOGLE_SECRET configured" />}
      {config.hasOIDC && <CheckRow status="pass" label="OIDC" detail="OIDC_CLIENT_ID + OIDC_CLIENT_SECRET + OIDC_ISSUER_URL configured" />}
      {config.hasLocalPassword && <CheckRow status="pass" label="Local admin password" detail="DASHCLAW_LOCAL_ADMIN_PASSWORD configured" />}

      <CheckRow
        status="info"
        label="Agent API access"
        detail="Agents authenticate via x-api-key header. Generate keys on the API Keys page."
      />
    </>
  );
}

// --- SDK verification section ---

function SdkSection() {
  return (
    <>
      <CheckRow
        status="info"
        label="Validate integration (Node.js)"
        detail="Run the companion validation script to test connectivity, auth, and endpoints:"
      />
      <div className="px-5 pb-3">
        <CodeBlock>{`node .claude/skills/dashclaw-platform-intelligence/scripts/validate-integration.mjs \\
  --base-url http://localhost:3000 \\
  --api-key $DASHCLAW_API_KEY \\
  --full`}</CodeBlock>
      </div>
      <CheckRow
        status="info"
        label="Validate integration (Python)"
        detail="Python SDK — install and run a basic connectivity check:"
      />
      <div className="px-5 pb-3">
        <CodeBlock>{`pip install dashclaw
python -c "from dashclaw import DashClaw; dc = DashClaw(base_url='http://localhost:3000', api_key='YOUR_KEY'); print(dc.ping())"`}</CodeBlock>
      </div>
      <CheckRow
        status="info"
        label="API docs"
        detail="Browse available endpoints and SDK method reference:"
      />
      <div className="px-5 pb-3 flex gap-3 flex-wrap">
        <Link href="/docs" className="text-xs text-brand hover:underline">
          View API docs →
        </Link>
        <Link href="/api-keys" className="text-xs text-zinc-400 hover:text-zinc-200 transition-colors">
          Manage API keys →
        </Link>
      </div>
    </>
  );
}

// --- Recommended next steps ---

function RecommendedSteps({ report }) {
  const { db, config, auth } = report;
  const steps = [];

  if (db.reason === 'missing_database_url') {
    steps.push({
      title: 'Set DATABASE_URL',
      variant: 'error',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            Add <code className="text-brand">DATABASE_URL</code> to your{' '}
            <code className="text-brand">.env</code> file and restart the server.
          </p>
          <CodeBlock>{`DATABASE_URL=postgres://user:password@localhost:5432/dashclaw`}</CodeBlock>
          <p className="text-xs text-zinc-500 mt-3">
            For Neon: use the connection string from your Neon project dashboard.
            For local Docker: match the string in your <code>docker-compose.yml</code>.
          </p>
        </>
      ),
    });
  }

  if (db.reason === 'connection_error') {
    steps.push({
      title: 'Fix database connection',
      variant: 'error',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            <code className="text-brand">DATABASE_URL</code> is set but the database is not responding.
            Check that your database is running and the connection string is correct.
          </p>
          <CodeBlock>{`# Verify DATABASE_URL is set
echo $DATABASE_URL

# Start local Postgres via Docker
docker compose up -d`}</CodeBlock>
          <p className="text-xs text-zinc-500 mt-3">
            Common causes: database not running, wrong hostname or port, wrong credentials.
          </p>
        </>
      ),
    });
  }

  if (db.reason === 'no_tables') {
    steps.push({
      title: 'Run migrations',
      variant: 'warn',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            Database connected but {db.missing.length} core table{db.missing.length === 1 ? '' : 's'} missing
            ({db.missing.join(', ')}). Run the bootstrap migrations:
          </p>
          <CodeBlock>{`node scripts/_run-with-env.mjs scripts/migrate-multi-tenant.mjs
node scripts/_run-with-env.mjs scripts/migrate-cost-analytics.mjs
node scripts/_run-with-env.mjs scripts/migrate-identity-binding.mjs
node scripts/_run-with-env.mjs scripts/migrate-capabilities.mjs`}</CodeBlock>
          <p className="text-xs text-zinc-500 mt-3">
            After running, reload this page to verify.
          </p>
        </>
      ),
    });
  }

  if (config.missingRequired.length > 0) {
    steps.push({
      title: 'Set required environment variables',
      variant: 'error',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            The following required variables are not set:{' '}
            <span className="text-red-400 font-mono">{config.missingRequired.map((v) => v.key).join(', ')}</span>
          </p>
          {config.missingRequired.map((v) => (
            <div key={v.key} className="mb-2">
              <p className="text-xs text-zinc-400 mb-1">
                <code className="text-brand">{v.key}</code> — {v.description}
              </p>
              <p className="text-xs text-zinc-500">{v.help}</p>
            </div>
          ))}
        </>
      ),
    });
  }

  if (db.ok && !auth.ok) {
    steps.push({
      title: 'Configure a sign-in method',
      variant: 'warn',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-4">
            Database is ready. Configure at least one sign-in method to access the dashboard.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
              <p className="text-xs font-semibold text-zinc-200 mb-2">Solo / Local access</p>
              <p className="text-xs text-zinc-400 mb-3">No OAuth app required.</p>
              <CodeBlock>{`DASHCLAW_LOCAL_ADMIN_PASSWORD=your-password`}</CodeBlock>
            </div>
            <div className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] p-4">
              <p className="text-xs font-semibold text-zinc-200 mb-2">OAuth (GitHub / Google)</p>
              <p className="text-xs text-zinc-400 mb-3">Register an OAuth app with your provider.</p>
              <CodeBlock>{`# GitHub
GITHUB_ID=your-client-id
GITHUB_SECRET=your-client-secret`}</CodeBlock>
            </div>
          </div>
          <p className="text-xs text-zinc-500 mt-4">
            After updating <code>.env</code>, restart the server and reload this page.
          </p>
        </>
      ),
    });
  }

  if (config.ok && auth.ok && config.missingAdvisory.length > 0) {
    steps.push({
      title: 'Optional configuration improvements',
      variant: 'info',
      body: (
        <>
          <p className="text-sm text-zinc-300 mb-3">
            Instance is ready, but these variables improve reliability:
          </p>
          {config.missingAdvisory.map((v) => (
            <div key={v.key} className="mb-2">
              <p className="text-xs text-zinc-400">
                <code className="text-brand">{v.key}</code> — {v.description}
              </p>
              <p className="text-xs text-zinc-500">{v.help}</p>
            </div>
          ))}
        </>
      ),
    });
  }

  if (steps.length === 0) return null;

  return (
    <div className="mt-8">
      <p className="text-xs text-zinc-500 uppercase tracking-widest mb-3">Recommended next steps</p>
      <div className="space-y-3">
        {steps.map((step, i) => (
          <ActionBlock key={i} title={step.title} variant={step.variant}>
            {step.body}
          </ActionBlock>
        ))}
      </div>
    </div>
  );
}

// --- Utility components ---

function ActionBlock({ title, variant, children }) {
  const borderColor = {
    error: 'border-red-900/50',
    warn: 'border-amber-900/50',
    info: 'border-[rgba(255,255,255,0.08)]',
  }[variant] || 'border-[rgba(255,255,255,0.08)]';

  const titleColor = {
    error: 'text-red-400',
    warn: 'text-amber-400',
    info: 'text-zinc-300',
  }[variant] || 'text-zinc-200';

  return (
    <div className={`rounded-xl border bg-[#111] p-5 ${borderColor}`}>
      <p className={`text-sm font-semibold mb-3 ${titleColor}`}>{title}</p>
      {children}
    </div>
  );
}

function CodeBlock({ children }) {
  return (
    <pre className="rounded-lg bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] px-4 py-3 text-xs font-mono text-zinc-300 overflow-x-auto whitespace-pre-wrap">
      {children}
    </pre>
  );
}
