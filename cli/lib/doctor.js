// cli/lib/doctor.js
import { bold, dim, green, yellow, red } from './render.js';

// Brand orange (256-color ANSI). Used sparingly — header + key accents only.
const BRAND = (s) => `\x1b[38;5;208m${s}\x1b[0m`;

const ICONS = {
  pass: green('\u2713'),
  warn: yellow('\u26a0'),
  fail: red('\u2717'),
};

const CATEGORY_LABELS = {
  database: 'Database',
  config: 'Configuration',
  auth: 'Authentication',
  deployment: 'Deployment',
  sdk: 'SDK Connectivity',
  governance: 'Governance',
};

const CATEGORY_ORDER = ['database', 'config', 'auth', 'deployment', 'sdk', 'governance'];

// Next-step guidance by check ID, used when the check has no auto-fix.
// Keep each line short and actionable.
const GUIDANCE = {
  db_connection: 'Check DATABASE_URL and that Postgres is reachable from your deployment.',
  env_NEXTAUTH_URL: 'Set NEXTAUTH_URL to your deployment URL (e.g. https://your.vercel.app).',
  env_CRON_SECRET: 'Set CRON_SECRET to protect /api/cron/* endpoints.',
  auth_signin: 'Configure an OAuth provider (GitHub/Google) or set DASHCLAW_LOCAL_ADMIN_PASSWORD.',
  deploy_nextauth_url: 'Set NEXTAUTH_URL to match your deployment domain.',
  deploy_cors: 'Set ALLOWED_ORIGIN if your agents run from a different domain.',
  sdk_reachable: 'Check DASHCLAW_BASE_URL and confirm your instance is deployed and awake.',
  sdk_auth: 'API key rejected — verify DASHCLAW_API_KEY matches the key on your instance.',
  gov_actions: 'Send your first governed action with claw.guard() via the SDK.',
  gov_stale: "Agents haven't reported in 7 days — check your agent pairings.",
};

function hr(width = 72) {
  return dim('\u2500'.repeat(width));
}

/**
 * Return an actionable next-step string for a non-passing check, or null.
 */
function nextStepFor(check, { noFix }) {
  if (!check || check.status === 'pass') return null;

  // Auto-fixable check: direct the user to the fix.
  if (check.fix?.type === 'auto') {
    if (noFix) {
      return `${check.fix.description}. Re-run without ${bold('--no-fix')} to apply.`;
    }
    // Fix was attempted (or will run in this invocation); describe what it does.
    return check.fix.description + '.';
  }

  // Fall back to the guidance table for warn/fail without an auto-fix.
  return GUIDANCE[check.id] || null;
}

/**
 * Run doctor via the API and render results.
 * @param {{ baseUrl: string, apiKey: string, json?: boolean, noFix?: boolean, category?: string }} options
 */
export async function runDoctor({ baseUrl, apiKey, json, noFix, category }) {
  const base = baseUrl.replace(/\/+$/, '');
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

  let url = `${base}/api/doctor?include_fixes=true`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  let res;
  try {
    res = await fetch(url, { headers });
  } catch (err) {
    console.error(red(`\nError: Could not reach DashClaw at ${base}`));
    console.error(dim(`  ${err.cause?.code || err.message}`));
    console.error(dim(`  Check DASHCLAW_BASE_URL and confirm your instance is running.\n`));
    process.exit(1);
  }

  if (res.status === 401 || res.status === 403) {
    console.error(red(`\nError: API key rejected by ${base} (${res.status}).`));
    console.error(dim(`  Check DASHCLAW_API_KEY matches the key on your instance.\n`));
    process.exit(1);
  }

  if (!res.ok && res.status !== 503) {
    const errText = await res.text().catch(() => '');
    console.error(red(`Doctor check failed (${res.status}): ${errText}`));
    process.exit(1);
  }

  const result = await res.json();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'healthy' ? 0 : 1);
  }

  // --- Header ----------------------------------------------------------------
  const hostLabel = base.replace(/^https?:\/\//, '');
  console.log();
  console.log(`  ${BRAND('[DashClaw]')} ${bold('Doctor')}   ${dim(hostLabel)}`);
  console.log();

  // --- Grouped checks --------------------------------------------------------
  const grouped = {};
  for (const check of result.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const cat of CATEGORY_ORDER) {
    const checks = grouped[cat];
    if (!checks || checks.length === 0) continue;

    console.log(`  ${bold(CATEGORY_LABELS[cat] || cat)}`);
    for (const check of checks) {
      const icon = ICONS[check.status] || '?';
      const titleStyled = check.status === 'pass' ? check.title : bold(check.title);
      console.log(`  ${icon} ${titleStyled}`);

      if (check.status !== 'pass') {
        console.log(`    ${dim(check.message)}`);
        const tip = nextStepFor(check, { noFix });
        if (tip) {
          console.log(`    ${dim('\u2192')} ${tip}`);
        }
      }
    }
    console.log();
  }

  // --- Auto-fix (remote fixes only; local-only fixes blocked by API) --------
  let fixCount = 0;
  let latestRecheck = null;
  if (!noFix) {
    const fixable = result.checks.filter((c) => c.status === 'fail' && c.fix?.type === 'auto');
    if (fixable.length > 0) {
      console.log(`  ${bold('Applying auto-fixes...')}`);
      for (const check of fixable) {
        try {
          const fixRes = await fetch(`${base}/api/doctor/fix`, {
            method: 'POST',
            headers,
            body: JSON.stringify({ action: check.fix.action }),
          });
          const fixResult = await fixRes.json();
          if (fixResult.applied) {
            console.log(`  ${green('\u2192')} Fixed: ${fixResult.description}`);
            fixCount++;
            if (fixResult.recheck) latestRecheck = fixResult.recheck;
          } else {
            console.log(`  ${dim('\u2192')} Skipped: ${fixResult.description}`);
          }
        } catch (err) {
          console.log(`  ${red('\u2717')} Fix "${check.fix.action}" failed: ${err.cause?.code || err.message}`);
        }
      }
      console.log();
    }
  }

  // --- Summary ---------------------------------------------------------------
  const reporting = latestRecheck || result;
  const { pass, warn, fail } = reporting.summary;

  console.log(hr());
  console.log();

  const segments = [
    green(`${pass} passed`),
    warn > 0 ? yellow(`${warn} warning${warn !== 1 ? 's' : ''}`) : dim('0 warnings'),
    fail > 0 ? red(`${fail} failed`) : dim('0 failed'),
  ];
  console.log(`  ${segments.join('   ' + dim('\u00b7') + '   ')}`);
  console.log();

  // --- Contextual footer -----------------------------------------------------
  const healthy = reporting.status === 'healthy';

  if (fixCount > 0) {
    console.log(`  ${green('\u2713')} ${fixCount} issue${fixCount !== 1 ? 's' : ''} auto-fixed this run.`);
  }

  if (noFix) {
    const autoFixable = result.checks.filter(
      (c) => c.status !== 'pass' && c.fix?.type === 'auto',
    ).length;
    if (autoFixable > 0) {
      console.log(
        `  ${BRAND('\u2192')} ${autoFixable} issue${autoFixable !== 1 ? 's' : ''} can be auto-fixed. Run: ${bold('dashclaw doctor')}`,
      );
    }
  }

  if (!healthy) {
    console.log(`  ${dim('Docs:')} ${base}/setup`);
  } else {
    console.log(`  ${green('\u2713')} ${bold('All systems healthy')} — ${dim('ready to govern actions')}`);
  }
  console.log();

  process.exit(healthy ? 0 : 1);
}
