import { execFileSync } from 'child_process';
import './_load-env.mjs';

const script = process.argv[2];
if (!script) {
  console.error('Usage: node scripts/_run-with-env.mjs <script>');
  process.exit(1);
}
const extraArgs = process.argv.slice(3);
execFileSync('node', [script, ...extraArgs], { stdio: 'inherit', env: process.env });
