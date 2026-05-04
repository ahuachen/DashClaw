# Show HN Launch Post — Claude Code Beachhead (DOG-04)

*Draft committed to docs/launch/ before launch day (D-16 same-day blitz).
Post verbatim on Tue/Wed/Thu 8-11am ET (D-17). Submit URL is
`https://dashclaw.io`. Do NOT submit until the homepage hero video is
backfilled with a real embed — URL-change after submission kills rank
(Pitfall 1).*

---

Title: Show HN: DashClaw – Govern Claude Code before it runs rm -rf

---

I got tired of Claude Code silently running destructive commands. It
has blown away a node_modules I needed, force-pushed to main, and wiped
a migration I hadn't committed yet. I needed a pause button.

DashClaw is a PreToolUse hook for Claude Code. Every Bash, Edit, Write,
and MultiEdit call goes through a policy check before it executes. The
default pack allows commits and test runs, hard-blocks rm -rf and
force-pushes to main, and for ambiguous things routes a Discord DM to
my phone with Approve / Deny buttons. Round-trip is about eight seconds.

It's a Node/Next.js app you self-host. Free tier on Vercel + Neon, one
click to deploy. The semantic guard uses your own OpenAI or Anthropic
key, so the governance loop costs about a cent per approval. The audit
ledger at /decisions keeps a signed record of every call and verdict.

3-min walkthrough + full writeup: https://dashclaw.io/blog/claude-code-beachhead

I've been dogfooding this on my own Claude Code for months. It's the
reason I haven't had a "wait, what did it just run" moment in weeks.

Free forever for solo devs on the Claude Code path. Pro tier launches
when DashClaw hits 50 verified Claude Code integrations in the wild.
Committed publicly at https://dashclaw.io/pricing — live counter.

Honest feedback welcome. What breaks? What's a policy you wish the
starter pack shipped by default?
