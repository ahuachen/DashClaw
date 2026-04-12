// app/lib/doctor/fixes/create-default-policy.mjs
import { getSql } from '../../db.js';

export async function apply() {
  try {
    const sql = getSql();
    const id = `pol_doctor_${Date.now()}`;
    await sql`
      INSERT INTO guard_policies (id, org_id, name, policy_type, rules, enabled)
      VALUES (
        ${id},
        'org_default',
        'Doctor: Log All Actions',
        'risk_threshold',
        ${JSON.stringify({ threshold: 100, action: 'warn' })}::jsonb,
        true
      )
      ON CONFLICT DO NOTHING
    `;
    return {
      applied: true,
      description: 'Created default governance policy (warn at risk 100)',
    };
  } catch (err) {
    return { applied: false, description: `Failed to create policy: ${err.message}` };
  }
}
