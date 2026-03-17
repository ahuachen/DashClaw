#!/usr/bin/env node

const { execSync } = require('node:child_process');

const IMAGE = 'ghcr.io/ucsandman/dashclaw-demo:latest';

console.log('DashClaw Demo\n');

// Check Docker is available
try {
  execSync('docker info', { stdio: 'ignore' });
} catch (e) {
  console.error('Docker is required to run the DashClaw demo.');
  console.error('Install Docker Desktop: https://www.docker.com/products/docker-desktop/');
  console.error('Then re-run: npx dashclaw-demo');
  process.exit(1);
}

// Pull the latest image
console.log('Pulling DashClaw demo image...');
execSync(`docker pull ${IMAGE}`, { stdio: 'inherit' });

console.log('\nStarting DashClaw demo on http://localhost:3000 ...\n');

try {
  execSync(
    `docker run --rm -p 3000:3000 -e DASHCLAW_MODE=demo -e NEXT_PUBLIC_DASHCLAW_MODE=demo ${IMAGE}`,
    { stdio: 'inherit' }
  );
} catch (error) {
  // Graceful exit on Ctrl+C (SIGINT sends status null / signal SIGINT)
  if (error.signal === 'SIGINT' || error.status === 130) {
    // Normal user-initiated stop
  }
}

console.log('\nDemo stopped.');
process.exit(0);
