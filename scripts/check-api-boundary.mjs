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
  'guard',
  'actions',
  'approvals',
  'assumptions',
  'policies',
  'signals',
  'health',
  'agents',      // Essential infrastructure (presence)
  'webhooks',    // Essential infrastructure (alerts)
  '_archive', // The quarantine zone
  'auth',     // Essential infrastructure
  'keys',     // Essential infrastructure
  'orgs',     // Essential infrastructure
  'team',     // Essential infrastructure (admin)
  'usage',    // Essential infrastructure (meters)
  'setup',    // Readiness surface
  'events',   // Real-time events (SSE)
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
        console.error(`❌ BOUNDARY VIOLATION: '${item}' is not a core governance route.`);
        console.error(`   Move 'app/api/${item}' to 'app/api/_archive/${item}' to maintain the minimal runtime.`);
        violations++;
      }
    }
  }

  if (violations > 0) {
    console.error(`\n🚫 Boundary check failed with ${violations} violations.`);
    console.error(`DashClaw is infrastructure, not a platform. Keep the runtime small.`);
    process.exit(1);
  }

  console.log('✅ Boundary check passed. Runtime is clean.');
}

checkBoundary();
