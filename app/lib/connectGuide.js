import { getSdkCommands } from './readiness.mjs';

function getBaseUrl(host) {
  if (!host) return 'https://your-dashclaw-host';
  if (host.startsWith('http://') || host.startsWith('https://')) return host;
  const protocol = host.startsWith('localhost') || host.startsWith('127.0.0.1') ? 'http' : 'https';
  return `${protocol}://${host}`;
}

export function getConnectGuideContent({ host = '' } = {}) {
  const baseUrl = getBaseUrl(host);
  const validator = getSdkCommands(host);

  return {
    baseUrl,
    intro:
      'This page gets a real Node or Python agent reporting live actions to DashClaw.',
    agentRequirementsNote:
      'Your agent only needs DASHCLAW_BASE_URL and DASHCLAW_API_KEY. It never needs DATABASE_URL.',
    successChecks: [
      'Your first action appears in the dashboard and recent activity.',
      'The agent shows up in live DashClaw traffic once it starts sending actions.',
      'If you enable verified mode, the pairing shows as approved.',
      'If policies are active, future risky actions can route into guard and approvals.',
    ],
    commonMistakes: [
      'Use your DashClaw instance URL, not an API route or localhost from a different machine.',
      'Set DASHCLAW_API_KEY in the agent runtime before running the snippet or validator.',
      'Keep DATABASE_URL on the DashClaw server only. The agent should never need it.',
    ],
    languages: {
      node: {
        label: 'Node',
        installCommand: 'npm install dashclaw',
        envBlock: `DASHCLAW_BASE_URL=${baseUrl}
DASHCLAW_API_KEY=<your-workspace-api-key>`,
        starterSnippet: `import { DashClaw } from 'dashclaw';

const claw = new DashClaw({
  baseUrl: process.env.DASHCLAW_BASE_URL,
  apiKey: process.env.DASHCLAW_API_KEY,
  agentId: 'my-agent',
  agentName: 'My Agent',
});

await claw.createAction({
  action_type: 'test',
  declared_goal: 'Verify DashClaw connection',
  risk_score: 10,
});`,
        optionalPairingSnippet: `const privateJwk = JSON.parse(process.env.AGENT_PRIVATE_KEY_JWK);

const { pairing, pairing_url } = await claw.createPairingFromPrivateJwk(privateJwk, {
  agentName: 'My Agent',
});

console.log('Approve pairing at:', pairing_url);
await claw.waitForPairing(pairing.id);`,
        validatorCommand: validator.node,
        validatorSummary:
          'This confirms your instance can accept real authenticated SDK traffic and can attach proof back to /setup.',
      },
      python: {
        label: 'Python',
        installCommand: 'pip install dashclaw',
        envBlock: `DASHCLAW_BASE_URL=${baseUrl}
DASHCLAW_API_KEY=<your-workspace-api-key>`,
        starterSnippet: `import os
from dashclaw import DashClaw

claw = DashClaw(
    base_url=os.environ["DASHCLAW_BASE_URL"],
    api_key=os.environ["DASHCLAW_API_KEY"],
    agent_id="my-agent",
    agent_name="My Agent",
)

claw.create_action(
    action_type="test",
    declared_goal="Verify DashClaw connection",
    risk_score=10,
)`,
        optionalPairingSnippet: `private_jwk = {
    "kty": "<your-private-jwk-type>",
    "n": "<...>",
    "e": "<...>",
    "d": "<...>",
}

pairing = claw.create_pairing_from_private_jwk(private_jwk, agent_name="My Agent")
pairing_id = pairing["pairing"]["id"]

print("Approve pairing at:", pairing["pairing_url"])
claw.wait_for_pairing(pairing_id, timeout=300, interval=2)`,
        validatorCommand: validator.pythonCapture,
        validatorSummary:
          'This captures proof that a live SDK integration worked against your DashClaw instance and feeds it back into /setup.',
      },
    },
  };
}
