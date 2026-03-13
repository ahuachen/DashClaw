import { describe, expect, it } from 'vitest';

import { getConnectGuideContent } from '@/lib/connectGuide.js';

describe('connect guide content', () => {
  it('builds a node golden path with env vars, starter code, validator, and optional pairing', () => {
    const content = getConnectGuideContent({ host: 'dashclaw.example.com' });

    expect(content.baseUrl).toBe('https://dashclaw.example.com');
    expect(content.languages.node.envBlock).toContain('DASHCLAW_BASE_URL=https://dashclaw.example.com');
    expect(content.languages.node.envBlock).toContain('DASHCLAW_API_KEY=<your-workspace-api-key>');
    expect(content.languages.node.starterSnippet).toContain('await claw.createAction');
    expect(content.languages.node.validatorCommand).toContain('--capture-setup-proof');
    expect(content.languages.node.optionalPairingSnippet).toContain('createPairingFromPrivateJwk');
  });

  it('builds a python golden path with explicit no-database note and pairing guidance', () => {
    const content = getConnectGuideContent({ host: 'localhost:3000' });

    expect(content.baseUrl).toBe('http://localhost:3000');
    expect(content.agentRequirementsNote).toContain('never needs DATABASE_URL');
    expect(content.languages.python.envBlock).toContain('DASHCLAW_BASE_URL=http://localhost:3000');
    expect(content.languages.python.starterSnippet).toContain('claw.create_action');
    expect(content.languages.python.validatorCommand).toContain('/api/setup/live-proof');
    expect(content.languages.python.optionalPairingSnippet).toContain('create_pairing_from_private_jwk');
  });
});
