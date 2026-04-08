import fs from 'node:fs/promises';
import path from 'node:path';
import { DashClaw } from '../../../sdk/dashclaw.js';

async function readJson(rootDir, relativePath) {
  const fullPath = path.join(rootDir, relativePath);
  const raw = await fs.readFile(fullPath, 'utf8');
  return JSON.parse(raw);
}

async function readPythonVersion(rootDir) {
  const pyprojectPath = path.join(rootDir, 'sdk-python', 'pyproject.toml');
  const raw = await fs.readFile(pyprojectPath, 'utf8');
  const match = raw.match(/^version\s*=\s*"([^"]+)"/m);
  if (!match) {
    throw new Error('Could not determine Python SDK version from sdk-python/pyproject.toml');
  }
  return match[1];
}

async function readPythonMethods(rootDir) {
  const clientPath = path.join(rootDir, 'sdk-python', 'dashclaw', 'client.py');
  const raw = await fs.readFile(clientPath, 'utf8');
  return Array.from(raw.matchAll(/^    def ([A-Za-z_][A-Za-z0-9_]*)\(/gm), (match) => match[1]);
}

function selectPythonMethods(methods, canonicalRoot) {
  if (canonicalRoot === 'capabilities') {
    return methods.filter((method) => method.includes('capability') || method.includes('capabilities'));
  }

  return methods.filter((method) => !method.startsWith('_'));
}

function discoverNodeMethods() {
  const sdk = new DashClaw({
    baseUrl: 'http://localhost',
    apiKey: 'test-key',
    agentId: 'test-agent',
  });
  return Object.keys(sdk.execution?.capabilities || {});
}

export async function discoverSdkSurface(rootDir) {
  const nodePackage = await readJson(rootDir, 'sdk/package.json');

  return {
    nodeMethods: discoverNodeMethods(),
    pythonMethods: selectPythonMethods(
      await readPythonMethods(rootDir),
      (await readJson(rootDir, 'contracts/sdk/public-surface.json')).python?.canonical_root,
    ),
    nodeVersion: nodePackage.version,
    pythonVersion: await readPythonVersion(rootDir),
  };
}

export async function checkSdkSurface(contracts, discoveredSurface = null) {
  const findings = [];
  const publicSurface = contracts.sdk['public-surface'];
  const releasePlan = contracts.sdk['release-plan'];
  const discovered = discoveredSurface || await discoverSdkSurface(process.cwd());

  for (const method of publicSurface.node?.required_methods || []) {
    if (!discovered.nodeMethods.includes(method)) {
      findings.push({
        code: 'missing_node_sdk_method',
        message: `Node SDK execution.capabilities is missing required method "${method}"`,
      });
    }
  }

  for (const method of discovered.nodeMethods || []) {
    if (!(publicSurface.node?.required_methods || []).includes(method)) {
      findings.push({
        code: 'undeclared_node_sdk_method',
        message: `Node SDK execution.capabilities exposes undeclared public method "${method}". Update contracts/sdk/public-surface.json and contracts/sdk/release-plan.json.`,
      });
    }
  }

  for (const method of publicSurface.python?.required_methods || []) {
    if (!(discovered.pythonMethods || []).includes(method)) {
      findings.push({
        code: 'missing_python_sdk_method',
        message: `Python SDK ${publicSurface.python?.canonical_root || 'public surface'} is missing required method "${method}"`,
      });
    }
  }

  for (const method of discovered.pythonMethods || []) {
    if (!(publicSurface.python?.required_methods || []).includes(method)) {
      findings.push({
        code: 'undeclared_python_sdk_method',
        message: `Python SDK ${publicSurface.python?.canonical_root || 'public surface'} exposes undeclared public method "${method}". Update contracts/sdk/public-surface.json and contracts/sdk/release-plan.json.`,
      });
    }
  }

  if (releasePlan.node?.current_version !== discovered.nodeVersion) {
    findings.push({
      code: 'node_release_plan_version_mismatch',
      message: `Node SDK release plan version ${releasePlan.node?.current_version} does not match sdk/package.json version ${discovered.nodeVersion}`,
    });
  }

  if (releasePlan.python?.current_version !== discovered.pythonVersion) {
    findings.push({
      code: 'python_release_plan_version_mismatch',
      message: `Python SDK release plan version ${releasePlan.python?.current_version} does not match sdk-python/pyproject.toml version ${discovered.pythonVersion}`,
    });
  }

  return {
    ok: findings.length === 0,
    findings,
    discovered,
  };
}
