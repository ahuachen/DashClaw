// app/lib/doctor/fixes/migrate.mjs
import { readdirSync, readFileSync } from 'node:fs';
import { resolve } from 'node:path';

/**
 * Run DDL migrations — same logic as POST /api/setup/migrate.
 * @param {{ env?: object }} options
 */
export async function apply({ env = process.env } = {}) {
  const { default: postgres } = await import('postgres');

  const url = env.DATABASE_URL;
  if (!url) return { applied: false, description: 'DATABASE_URL not set — cannot run migrations' };

  const sql = postgres(url, { max: 1, connect_timeout: 30, idle_timeout: 5 });

  try {
    const drizzleDir = resolve(process.cwd(), 'drizzle');
    const sqlFiles = readdirSync(drizzleDir).filter((f) => f.endsWith('.sql')).sort();
    const ddl = sqlFiles
      .map((f) => readFileSync(resolve(drizzleDir, f), 'utf8'))
      .join('\n--> statement-breakpoint\n');

    const statements = ddl
      .split('--> statement-breakpoint')
      .map((s) => s.trim())
      .filter(Boolean);
    const SAFE_CODES = new Set(['42P07', '42P16', '42701', '42710', '42P10', '23505']);

    let created = 0;
    let skipped = 0;
    for (const stmt of statements) {
      try {
        if (stmt.includes('vector(') && !stmt.startsWith('CREATE EXTENSION')) {
          await sql.unsafe('CREATE EXTENSION IF NOT EXISTS vector');
        }
        await sql.unsafe(stmt);
        created++;
      } catch (err) {
        if (SAFE_CODES.has(err.code)) skipped++;
        // Other errors are silently skipped — same as /api/setup/migrate
      }
    }

    // Seed org_default
    await sql`
      INSERT INTO organizations (id, name, slug, plan)
      VALUES ('org_default', 'Default Organization', 'default', 'pro')
      ON CONFLICT (id) DO NOTHING
    `;

    return {
      applied: true,
      description: `Ran migrations: ${created} applied, ${skipped} skipped (already exist)`,
    };
  } catch (err) {
    return { applied: false, description: `Migration failed: ${err.message}` };
  } finally {
    await sql.end({ timeout: 2 });
  }
}
