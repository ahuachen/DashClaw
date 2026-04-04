import { readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { dirname } from 'node:path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

/**
 * CI Check: Governance Boundary Enforcement
 * 
 * DashClaw is a focused governance runtime. 
 * This script ensures that ONLY core governance routes exist in app/api/.
 * Non-core features MUST live in app/api/_archive/.
 */

const ALLOWED_RUNTIME_ROUTES = new Set([
  // Tier 1: Core Governance
  'guard',
  'actions',
  'approvals',
  'assumptions',
  'policies',
  'signals',
  'health',

  // Tier 2: Governance Extensions (Active)
  'compliance',
  'drift',
  'evaluations',
  'messages',
  'prompts',
  'scoring',
  'webhooks',
  'swarm',
  'learning',

  // Tier 3: Essential Infrastructure
  'auth',
  'keys',
  'orgs',
  'team',
  'usage',
  'setup',
  'agents',
  'activity',
  'stream',
  'cron',
  'settings',
  'integrations',
  'security',
  'docs',
  'pairings',      // Agent identity pairing enrollment
  'identities',    // Approved agent identity management
  'sessions',      // Agent session lifecycle tracking

  // The Quarantine Zone
  '_archive',
]);

const apiDir = join(__dirname, '../app/api');

function checkBoundary() {
  console.log('🛡️ Checking DashClaw Governance Boundary...');
  
  let violations = 0;
  const items = readdirSync(apiDir);

  for (const item of items) {
    const fullPath = join(apiDir, item);
    
    // Only check directories (API routes)
    if (statSync(fullPath).isDirectory()) {
      if (!ALLOWED_RUNTIME_ROUTES.has(item)) {
        console.error(`❌ BOUNDARY VIOLATION: '${item}' is not an approved governance route.`);
        console.error(`   Move 'app/api/${item}' to 'app/api/_archive/${item}' to maintain the minimal runtime.`);
        violations++;
      }
    }
  }

  if (violations > 0) {
    console.error(`\n🚫 Boundary check failed with ${violations} violations.`);
    console.error(`DashClaw is infrastructure, not a platform. Keep the runtime focused.`);
    process.exit(1);
  }

  console.log('✅ Boundary check passed. Runtime is clean.');
}

checkBoundary();
