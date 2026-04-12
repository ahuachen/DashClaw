// app/lib/doctor/fixes/fix-cors.mjs
import { writeEnvUpdates } from './env-writer.mjs';

/**
 * @param {{ origin?: string }} params
 */
export async function apply({ origin } = {}) {
  if (!origin) return { applied: false, description: 'No origin provided — cannot auto-fix CORS' };
  const { backedUp } = writeEnvUpdates({ ALLOWED_ORIGIN: origin });
  return {
    applied: true,
    description: `Set ALLOWED_ORIGIN to ${origin}${backedUp ? ' (backed up .env to .env.backup)' : ''}`,
  };
}
