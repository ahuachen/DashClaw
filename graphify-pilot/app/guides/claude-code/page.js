import { headers } from 'next/headers';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import PublicNavbar from '../../components/PublicNavbar';
import PublicFooter from '../../components/PublicFooter';
import GuideClient from '../GuideClient';
import { getGuideBaseUrl } from '../../lib/guideContent';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Claude Code Integration Guide - DashClaw',
  description: 'Govern Claude Code tool calls with DashClaw in under 20 minutes.',
};

export default async function ClaudeCodeGuidePage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const baseUrl = getGuideBaseUrl(host);

  const hookSettingsJson = `{
  "hooks": {
    "PreToolUse": [
      {
        "matcher": "Bash|Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/dashclaw_pretool.py"
          }
        ]
      }
    ],
    "PostToolUse": [
      {
        "matcher": "Bash|Edit|Write|MultiEdit",
        "hooks": [
          {
            "type": "command",
            "command": "python .claude/hooks/dashclaw_posttool.py"
          }
        ]
      }
    ]
  }
}`;

  const guardrailsYaml = `version: 1
project: my-claude-code-project
description: >
  Governance policy for Claude Code tool calls.
  Blocks destructive shell commands. Warns on deployment.

policies:
  - id: block_destructive_shell
    description: Block rm -rf and database drops
    applies_to:
      tools:
        - Bash
    rule:
      block: true
    when:
      command_contains:
        - "rm -rf"
        - "drop table"

  - id: warn_on_deploy
    description: Require approval for deployment commands
    applies_to:
      tools:
        - Bash
    rule:
      require: approval
    when:
      command_contains:
        - "git push"
        - "vercel deploy"`;

  const steps = [
    {
      number: 1,
      title: 'Deploy DashClaw',
      summary: 'Get a running instance. Click the Vercel deploy button or run locally.',
      note: 'Already have an instance? Skip to Step 2.',
    },
    {
      number: 2,
      title: 'Copy hook scripts into your project',
      summary: 'DashClaw hooks intercept Bash, Edit, Write, and MultiEdit tool calls.',
      codeTitle: 'Terminal',
      codeBody: `mkdir -p .claude/hooks
cp hooks/dashclaw_pretool.py  .claude/hooks/
cp hooks/dashclaw_posttool.py .claude/hooks/`,
    },
    {
      number: 3,
      title: 'Set environment variables',
      summary: 'Claude Code reads these from the shell or a .env file in the project root.',
      codeTitle: '.env',
      codeBody: `DASHCLAW_BASE_URL=${baseUrl}
DASHCLAW_API_KEY=<your-workspace-api-key>
DASHCLAW_HOOK_MODE=enforce`,
    },
    {
      number: 4,
      title: 'Add hooks to Claude Code settings',
      summary:
        'Merge this into your project\'s .claude/settings.json (or ~/.claude/settings.json for global).',
      codeTitle: '.claude/settings.json',
      codeBody: hookSettingsJson,
    },
    {
      number: 5,
      title: 'Run Claude Code and trigger a tool call',
      summary:
        'Ask Claude Code to do anything that uses Bash, Edit, Write, or MultiEdit. The hook fires automatically.',
      codeTitle: 'Example prompt',
      codeBody: 'Create a file called hello.txt with the contents "Hello from a governed agent"',
      note: 'Watch the terminal — you should see [DashClaw] messages as the hook evaluates the action.',
    },
    {
      number: 6,
      title: 'See the result in DashClaw',
      summary: 'Open your DashClaw dashboard to confirm the action was recorded.',
      note: "Go to /decisions — you should see your tool call in the ledger with action_type 'other' (for a simple file write) or 'security' (for sensitive files), status 'completed'.",
    },
  ];

  const proofMoment =
    "Go to /decisions — you should see your Claude Code tool call in the ledger. Look for action_type 'other' or 'security' with agent_id 'claude-code' and status 'completed'.";

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNavbar />

      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-300">
              Home
            </Link>
            <ChevronRight size={14} />
            <Link href="/connect" className="transition-colors hover:text-zinc-300">
              Connect
            </Link>
            <ChevronRight size={14} />
            <span className="text-zinc-300">Claude Code</span>
          </div>

          <GuideClient
            frameworkName="Claude Code"
            frameworkIcon="🤖"
            steps={steps}
            proofMoment={proofMoment}
            guardrailsYaml={guardrailsYaml}
            baseUrl={baseUrl}
          />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}
