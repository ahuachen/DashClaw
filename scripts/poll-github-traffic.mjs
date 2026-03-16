// Run daily via: npm run traffic:poll
// Suggested cron: 0 6 * * * (6am UTC daily)
// GitHub traffic API retains only 14 days — run at least weekly to avoid gaps

import { getSql } from '../app/lib/db.js';

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection:', reason);
  process.exit(1);
});

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = process.env.GITHUB_REPO_OWNER || 'ucsandman';
const REPO_NAME = process.env.GITHUB_REPO_NAME || 'DashClaw';

if (!GITHUB_TOKEN) {
  console.error('GITHUB_TOKEN is required. Set it in .env.local or environment.');
  process.exit(1);
}

if (!process.env.DATABASE_URL) {
  console.error('DATABASE_URL is required. Set it in .env.local or environment.');
  process.exit(1);
}

const sql = getSql();

// Ensure table exists
await sql`
  CREATE TABLE IF NOT EXISTS github_traffic (
    id TEXT PRIMARY KEY,
    metric TEXT NOT NULL,
    date DATE NOT NULL,
    count INTEGER NOT NULL,
    uniques INTEGER NOT NULL,
    recorded_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (metric, date)
  )
`;

async function fetchTraffic(metric) {
  const url = `https://api.github.com/repos/${REPO_OWNER}/${REPO_NAME}/traffic/${metric}`;
  const res = await fetch(url, {
    headers: {
      Authorization: `Bearer ${GITHUB_TOKEN}`,
      Accept: 'application/vnd.github+json',
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (!res.ok) {
    const body = await res.text();
    throw new Error(`GitHub API error for ${metric}: ${res.status} ${body}`);
  }

  return res.json();
}

async function upsertRows(metric, rows) {
  let processed = 0;
  for (const row of rows) {
    const date = row.timestamp.split('T')[0];
    const id = `${metric}_${date}`;

    await sql`
      INSERT INTO github_traffic (id, metric, date, count, uniques)
      VALUES (${id}, ${metric}, ${date}, ${row.count}, ${row.uniques})
      ON CONFLICT (metric, date) DO UPDATE SET
        count = EXCLUDED.count,
        uniques = EXCLUDED.uniques
    `;

    const label = metric === 'clones' ? 'clones' : 'views';
    console.log(`[${metric}] ${date}: ${row.count} ${label}, ${row.uniques} unique`);
    processed++;
  }
  return processed;
}

const [clonesData, viewsData] = await Promise.all([
  fetchTraffic('clones'),
  fetchTraffic('views'),
]);

const clonesCount = await upsertRows('clones', clonesData.clones || []);
const viewsCount = await upsertRows('views', viewsData.views || []);

console.log(`\nSummary: ${clonesCount + viewsCount} rows processed (${clonesCount} clones, ${viewsCount} views)`);
