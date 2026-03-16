import 'dotenv/config';
import { Agent, run, tool } from '@openai/agents';
import { z } from 'zod';
import { DashClaw, GuardBlockedError, ApprovalDeniedError } from 'dashclaw';

process.on('unhandledRejection', (reason) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

// -- DashClaw Setup -----------------------------------------------------------
const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL || 'http://localhost:3000',
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'pii-cleanup-agent',
});

// -- Simulated Database -------------------------------------------------------
const DATABASE = [
  { id: 'rec_001', name: 'Jane Doe', email: 'jane@example.com', ssn: '123-45-6789', type: 'customer' },
  { id: 'rec_002', name: 'Acme Corp', email: 'info@acme.com', ssn: null, type: 'business' },
  { id: 'rec_003', name: 'Bob Smith', email: 'bob@test.com', ssn: '987-65-4321', type: 'customer' },
  { id: 'rec_004', name: 'Test User', email: 'test@dev.local', ssn: null, type: 'internal' },
];

// -- Tools --------------------------------------------------------------------

const scanForPII = tool({
  name: 'scan_for_pii',
  description: 'Scan the database for records containing personally identifiable information (SSN, personal email, etc.)',
  parameters: z.object({
    record_type: z.string().optional().describe('Filter by record type: customer, business, internal'),
  }),
  execute: async ({ record_type }) => {
    const records = record_type
      ? DATABASE.filter(r => r.type === record_type)
      : DATABASE;
    const piiRecords = records.filter(r => r.ssn !== null);
    return JSON.stringify({
      total_scanned: records.length,
      pii_found: piiRecords.length,
      records: piiRecords.map(r => ({
        id: r.id,
        name: r.name,
        pii_fields: ['ssn', ...(r.email && !r.email.endsWith('.local') ? ['email'] : [])],
      })),
    });
  },
});

const deleteRecords = tool({
  name: 'delete_records',
  description: 'Permanently delete records from the database by their IDs. This is irreversible and requires governance approval.',
  parameters: z.object({
    record_ids: z.array(z.string()).describe('Array of record IDs to delete'),
    reason: z.string().describe('Justification for the deletion'),
  }),
  execute: async ({ record_ids, reason }) => {
    const deleted = [];
    for (const id of record_ids) {
      const idx = DATABASE.findIndex(r => r.id === id);
      if (idx !== -1) {
        deleted.push(DATABASE[idx].name);
        DATABASE.splice(idx, 1);
      }
    }
    return JSON.stringify({
      deleted_count: deleted.length,
      deleted_names: deleted,
      remaining_records: DATABASE.length,
    });
  },
});

// -- Agent --------------------------------------------------------------------

const agent = new Agent({
  name: 'PII Cleanup Agent',
  instructions: `You are a data governance agent responsible for finding and removing PII from databases.

Your workflow:
1. Scan the database for records containing PII (SSN, personal email addresses)
2. Report what you found — be specific about which records and what PII fields
3. Propose deleting the records that contain PII, with a clear justification
4. Execute the deletion

Always explain your reasoning. Be specific about which records and why.`,
  tools: [scanForPII, deleteRecords],
});

// -- Governed Run -------------------------------------------------------------

async function governedRun() {
  console.log('\n=== PII Cleanup Agent ===\n');

  // Step 1: Let the agent analyze the database
  console.log('Phase 1: Agent scanning database...\n');
  const result = await run(agent, 'Scan the customer database for PII and clean it up.');

  console.log('Agent Analysis:');
  console.log(result.finalOutput);

  // Step 2: Governance flow for the destructive action
  console.log('\n--- DashClaw Governance ---\n');

  try {
    // GUARD: Ask DashClaw if deletion is permitted
    console.log('Checking deletion policy via DashClaw Guard...');
    const decision = await claw.guard({
      action_type: 'delete_pii_records',
      declared_goal: 'Delete customer records containing SSN data for GDPR compliance',
      risk_score: 85,
      systems_touched: ['customer_database'],
      metadata: { record_count: 2, pii_types: ['ssn', 'email'] },
    });

    console.log(`Decision: ${(decision.decision || 'unknown').toUpperCase()}`);

    if (decision.decision === 'block') {
      console.log(`\nBLOCKED: ${decision.reason}`);
      return;
    }

    // ACTION: Declare intent
    const actionResult = await claw.createAction({
      action_type: 'delete_pii_records',
      declared_goal: 'Permanently delete 2 customer records containing SSN data',
      reasoning: 'Records rec_001 and rec_003 contain Social Security Numbers. Deletion required for GDPR Article 17 compliance.',
      risk_score: 85,
    });
    const actionId = actionResult.action?.action_id || actionResult.action_id;
    console.log(`Action recorded: ${actionId}`);

    // ASSUMPTION: Record beliefs
    await claw.recordAssumption({
      action_id: actionId,
      assumption: 'Records rec_001 and rec_003 are the only records with SSN data',
      basis: 'Database scan returned exactly 2 records with non-null SSN fields',
    });

    // HITL: Wait for human approval
    if (decision.decision === 'require_approval') {
      console.log('\nWAITING FOR HUMAN APPROVAL...');
      console.log(`  Approve at: ${process.env.DASHCLAW_BASE_URL || 'http://localhost:3000'}/approvals`);
      console.log('  (The agent is paused until an operator approves or denies)\n');

      await claw.waitForApproval(actionId);
      console.log('Approved by operator! Proceeding with deletion...\n');
    }

    // EXECUTE: Perform the actual deletion
    console.log('Deleting PII records...');
    const piiIds = ['rec_001', 'rec_003'];
    const before = DATABASE.length;
    for (const id of piiIds) {
      const idx = DATABASE.findIndex(r => r.id === id);
      if (idx !== -1) DATABASE.splice(idx, 1);
    }
    console.log(`  Deleted ${before - DATABASE.length} records. ${DATABASE.length} clean records remaining.`);

    // OUTCOME: Report result
    await claw.updateOutcome(actionId, {
      status: 'completed',
      output_summary: `Deleted ${before - DATABASE.length} PII records (${piiIds.join(', ')}). ${DATABASE.length} clean records remaining.`,
    });

    console.log(`\nCleanup complete. Evidence recorded in DashClaw.`);
    console.log(`  View trace: ${process.env.DASHCLAW_BASE_URL || 'http://localhost:3000'}/decisions/${actionId}\n`);

  } catch (error) {
    if (error.name === 'GuardBlockedError') {
      console.error(`\nBLOCKED BY POLICY: ${error.message}`);
    } else if (error.name === 'ApprovalDeniedError') {
      console.error(`\nDENIED BY OPERATOR: ${error.message}`);
    } else {
      console.error(`\nError: ${error.message}`);
    }
  }
}

governedRun();
