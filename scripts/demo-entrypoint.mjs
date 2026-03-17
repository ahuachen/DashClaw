import { spawn } from 'node:child_process';

const BASE_URL = 'http://localhost:3000';

async function waitReady(timeoutMs = 60000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(`${BASE_URL}/api/health`);
      if (res.ok) return true;
    } catch (e) {
      // Server not ready yet
    }
    await new Promise(r => setTimeout(r, 1000));
  }
  return false;
}

async function main() {
  // Start Next.js server
  const server = spawn('node', ['server.js'], {
    cwd: '/app',
    stdio: 'ignore',
  });

  const cleanup = () => {
    try { server.kill('SIGTERM'); } catch (e) { /* already dead */ }
  };
  process.on('SIGTERM', () => { cleanup(); process.exit(0); });
  process.on('SIGINT', () => { cleanup(); process.exit(0); });

  const ready = await waitReady();
  if (!ready) {
    console.error('❌ Server failed to start');
    cleanup();
    process.exit(1);
  }

  console.log('  DashClaw 1-Minute Governance Test');
  console.log('  =================================\n');
  console.log('[1/3] DashClaw runtime ready.');
  console.log('[2/3] Running governed agent action...');
  console.log('');

  const agent = spawn('node', ['/app/scripts/demo-agent.mjs'], {
    cwd: '/app',
    stdio: ['ignore', 'pipe', 'pipe'],
    env: {
      ...process.env,
      DASHCLAW_BASE_URL: BASE_URL,
      DASHCLAW_API_KEY: 'demo-key',
    },
  });

  let agentOutput = '';

  agent.stdout.on('data', (data) => {
    const text = data.toString();
    agentOutput += text;
    process.stdout.write(text);
  });

  agent.stderr.on('data', (data) => {
    const text = data.toString();
    agentOutput += text;
    process.stderr.write(text);
  });

  agent.on('close', (code) => {
    console.log('');
    if (code === 0) {
      console.log('[3/3] Demo complete.');

      const urlMatch = agentOutput.match(/\/replay\/[a-zA-Z0-9_-]+/);
      const replayUrl = urlMatch
        ? `${BASE_URL}${urlMatch[0]}`
        : `${BASE_URL}/demo`;

      console.log(`REPLAY_URL=${replayUrl}`);
      console.log('Press Ctrl+C to exit.');

      // Keep alive so the server stays running for browser inspection
      setInterval(() => {}, 10000);
    } else {
      console.error(`❌ Agent exited with code ${code}`);
      cleanup();
      process.exit(1);
    }
  });
}

main().catch(err => {
  console.error('Fatal error:', err);
  process.exit(1);
});
