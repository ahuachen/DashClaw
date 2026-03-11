import { readFileSync } from 'fs';
import { execFileSync } from 'child_process';

const lines = readFileSync('.env.local', 'utf8').split('\n');
for (const l of lines) {
  const idx = l.indexOf('=');
  if (idx > 0 && !l.startsWith('#')) {
    const key = l.slice(0, idx).trim();
    let value = l.slice(idx + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
    }
    process.env[key] = value;
  }
}

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/_run-with-env.mjs <script>');
  process.exit(1);
}
const extraArgs = process.argv.slice(3);
execFileSync('node', [script, ...extraArgs], { stdio: 'inherit', env: process.env });
