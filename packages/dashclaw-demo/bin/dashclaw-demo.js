#!/usr/bin/env node

const { execSync } = require('node:child_process');
const path = require('node:path');
const os = require('node:os');
const fs = require('node:fs');

console.log('DashClaw Demo\n');

// Detect if we are running locally inside the DashClaw monorepo
const projectRoot = path.resolve(__dirname, '../../..');
let isLocalDev = false;

try {
  const pkg = require(path.join(projectRoot, 'package.json'));
  if (pkg.name === 'dashclaw-platform') {
    isLocalDev = true;
  }
} catch (e) {
  // Not inside the repo
}

if (isLocalDev) {
  console.log('Running from local development workspace...\n');
  try {
    execSync('npm run demo', { cwd: projectRoot, stdio: 'inherit' });
  } catch (error) {
    process.exit(error.status || 1);
  }
} else {
  console.log('Starting local demo runtime...\n');
  const tempDir = path.join(os.tmpdir(), 'dashclaw-demo-' + Date.now());

  try {
    console.log(`Downloading DashClaw runtime to temporary directory...`);
    // giget downloads the tarball directly from github very quickly
    execSync(`npx --yes giget@latest github:ucsandman/DashClaw ${tempDir}`, { stdio: 'inherit' });

    console.log('\nInstalling dependencies (this takes a moment)...');
    execSync('npm install --no-fund --no-audit', { cwd: tempDir, stdio: 'ignore' });

    console.log('\nBooting DashClaw in demo mode...');
    execSync('npm run demo', { cwd: tempDir, stdio: 'inherit' });
  } catch (error) {
    console.error('\n❌ Demo failed to start.');
    process.exit(error.status || 1);
  } finally {
    try {
      if (fs.existsSync(tempDir)) {
        // Clean up on exit if possible
        fs.rmSync(tempDir, { recursive: true, force: true });
      }
    } catch (e) {
      // Ignore cleanup errors
    }
  }
}
