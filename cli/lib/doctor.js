// cli/lib/doctor.js
import { bold, dim, green, yellow, red } from './render.js';

const ICONS = { pass: green('\u2713'), warn: yellow('\u26a0'), fail: red('\u2717') };

const CATEGORY_LABELS = {
  database: 'Database',
  config: 'Configuration',
  auth: 'Auth',
  deployment: 'Deployment',
  sdk: 'SDK',
  governance: 'Governance',
};

const CATEGORY_ORDER = ['database', 'config', 'auth', 'deployment', 'sdk', 'governance'];

/**
 * Run doctor via the API and render results.
 * @param {{ baseUrl: string, apiKey: string, json?: boolean, noFix?: boolean, category?: string }} options
 */
export async function runDoctor({ baseUrl, apiKey, json, noFix, category }) {
  const headers = { 'Content-Type': 'application/json', 'x-api-key': apiKey };

  let url = `${baseUrl}/api/doctor?include_fixes=true`;
  if (category) url += `&category=${encodeURIComponent(category)}`;

  const res = await fetch(url, { headers });
  if (!res.ok && res.status !== 503) {
    const errText = await res.text();
    console.error(red(`Doctor check failed (${res.status}): ${errText}`));
    process.exit(1);
  }

  const result = await res.json();

  if (json) {
    console.log(JSON.stringify(result, null, 2));
    process.exit(result.status === 'healthy' ? 0 : 1);
  }

  // Rich output
  console.log();
  console.log(` ${bold('DashClaw Doctor')}  ${dim(`(${baseUrl})`)}`);
  console.log();

  const grouped = {};
  for (const check of result.checks) {
    if (!grouped[check.category]) grouped[check.category] = [];
    grouped[check.category].push(check);
  }

  for (const cat of CATEGORY_ORDER) {
    const checks = grouped[cat];
    if (!checks || checks.length === 0) continue;
    console.log(` ${bold(CATEGORY_LABELS[cat] || cat)}`);
    for (const check of checks) {
      console.log(`  ${ICONS[check.status] || '?'} ${check.title}`);
      if (check.status !== 'pass') {
        console.log(`    ${dim(check.message)}`);
      }
    }
    console.log();
  }

  // Auto-fix (remote-only fixes via API)
  let fixCount = 0;
  let latestRecheck = null;
  if (!noFix) {
    const fixable = result.checks.filter((c) => c.status === 'fail' && c.fix?.type === 'auto');
    for (const check of fixable) {
      const fixRes = await fetch(`${baseUrl}/api/doctor/fix`, {
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
        console.log(`  ${dim('\u2192')} ${fixResult.description}`);
      }
    }
  }

  // If fixes ran, use the updated recheck summary for reporting
  const reporting = latestRecheck || result;

  // Summary
  const { pass, warn, fail } = reporting.summary;
  const parts = [];
  if (pass > 0) parts.push(green(`${pass} passed`));
  if (warn > 0) parts.push(yellow(`${warn} warning${warn !== 1 ? 's' : ''}`));
  if (fail > 0) parts.push(red(`${fail} failed`));
  console.log(` ${bold('Summary:')} ${parts.join(', ')}`);

  if (fixCount > 0) {
    console.log(` ${green(`${fixCount} issue${fixCount !== 1 ? 's' : ''} auto-fixed this run`)}`);
  }

  // Manual action summary
  const manual = reporting.checks.filter(
    (c) => (c.status === 'fail' || c.status === 'warn') && (!c.fix || c.fix.type === 'manual'),
  );
  if (manual.length > 0) {
    console.log();
    console.log(` ${bold('Manual action needed:')}`);
    for (const check of manual) {
      console.log(`  ${yellow('\u2022')} ${check.message}`);
    }
  }

  console.log();
  process.exit(reporting.status === 'healthy' ? 0 : 1);
}
