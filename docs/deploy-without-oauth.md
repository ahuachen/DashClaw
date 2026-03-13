# Deploy DashClaw in Under 10 Minutes — No OAuth Required

This is the full path from zero to a live governance dashboard with a real agent
reporting decisions. No GitHub OAuth app. No Google Cloud Console. Just a password
and a deploy button.

---

## What You Need

- A free [Neon](https://neon.tech) account (Postgres database)
- A free [Vercel](https://vercel.com) account
- A GitHub account (to fork the repo — you will not use it for OAuth)
- 10 minutes

---

## Step 1 — Fork the Repo

Go to [github.com/ucsandman/DashClaw](https://github.com/ucsandman/DashClaw) and
click **Fork**. Accept all defaults. This gives you your own copy to deploy from.

---

## Step 2 — Create a Free Database

1. Sign up at [neon.tech](https://neon.tech)
2. Create a new project — name it anything, e.g. `dashclaw`
3. Copy the connection string. It looks like:
   ```
   postgresql://user:pass@ep-xyz.neon.tech/neondb
   ```
   You will paste this in the next step.

---

## Step 3 — Deploy to Vercel

1. Go to [vercel.com/new](https://vercel.com/new)
2. Import your forked DashClaw repository
3. Before clicking Deploy, open the **Environment Variables** panel and add these:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string from Step 2 |
   | `NEXTAUTH_URL` | `https://your-app.vercel.app` (use your actual Vercel URL) |
   | `NEXTAUTH_SECRET` | Run the command below and paste the output |
   | `DASHCLAW_API_KEY` | Run the command below and paste the output |
   | `ENCRYPTION_KEY` | Run the command below and paste the output |
   | `CRON_SECRET` | Run the command below and paste the output |
   | `DASHCLAW_LOCAL_ADMIN_PASSWORD` | A strong password of your choice |
   | `DASHCLAW_MODE` | `self_host` |
   | `NEXT_PUBLIC_DASHCLAW_MODE` | `self_host` |

   Generate the four secrets in one command:
   ```bash
   node -e "const c=require('crypto');console.log('NEXTAUTH_SECRET='+c.randomBytes(32).toString('base64url'));console.log('DASHCLAW_API_KEY=oc_live_'+c.randomBytes(24).toString('hex'));console.log('ENCRYPTION_KEY='+c.randomBytes(32).toString('base64url').slice(0,32));console.log('CRON_SECRET='+c.randomBytes(32).toString('hex'))"
   ```

4. Click **Deploy**

Vercel will build and deploy. Tables are created automatically on the first request.
No migrations to run manually.

Before signing in, open `https://your-app.vercel.app/setup`. That page verifies:
- the app is up
- the database is reachable and all required tables exist
- required vs advisory environment variables
- local password / OAuth auth readiness
- copy-ready SDK validation commands

`/setup` is intentionally safe to open before login. It shows verification state, recovery guidance, and a sanitized JSON proof download without exposing secret values.

---

## Step 4 — Sign In With Your Password

1. Visit `https://your-app.vercel.app/dashboard`
2. You will be redirected to the login page
3. You will see a password field below any OAuth buttons — enter the password you
   set as `DASHCLAW_LOCAL_ADMIN_PASSWORD`
4. You are in

No GitHub OAuth app. No redirect URIs. No client secrets. Just your password.

---

## Step 5 — Complete Onboarding

The dashboard walks you through four steps automatically:

1. **Create a workspace** — give your org a name, e.g. "My Agent Fleet"
2. **Generate an API key** — this is what your agents use to authenticate
3. **Install the SDK** — one npm or pip install
4. **Record your first action** — paste a snippet into your agent and run it

The onboarding checklist tracks your progress and shows you exactly what to do next.

---

## Step 6 — Connect Your First Agent

Install the SDK on any machine where your agent runs:

```bash
npm install dashclaw
```

Create a file called `agent.js`:

```javascript
import DashClaw from 'dashclaw';

const dc = new DashClaw({
  baseUrl: 'https://your-app.vercel.app',
  apiKey: 'oc_live_...' // the key from Step 5
});

await dc.createAction({
  agentId: 'my-first-agent',
  type: 'api_call',
  declared_goal: 'Fetch user data from CRM',
  risk_score: 20,
});

console.log('Action recorded. Check your dashboard.');
```

Run it:

```bash
node agent.js
```

Go back to your dashboard. The action appears in real time.

---

## Step 7 — Verify Sign-Out Works

Click your avatar or the sign-out button in the dashboard header. You should be
redirected to the login page. Visiting `/dashboard` again should require your
password. If it does, the session is clearing correctly.

---

## What You Just Proved

- DashClaw deploys to Vercel on the free tier with no OAuth setup
- A password is sufficient to protect a self-hosted instance
- An agent can report decisions to your dashboard in under a minute
- The entire thing — database, hosting, auth, and first agent — costs $0

---

## When to Add OAuth

Add GitHub or Google OAuth when you want to invite teammates. Go to
**Settings** in your dashboard, add your OAuth credentials, and both login methods
will be available on the login page. Your password login continues to work alongside
OAuth — you do not have to remove it.

---

## Troubleshooting

**Password field does not appear on login page**
`DASHCLAW_LOCAL_ADMIN_PASSWORD` is not set, or the deployment did not pick up the
new env var. Go to Vercel → your project → Settings → Environment Variables, confirm
the variable is there, then trigger a redeploy.

**"Incorrect password" error**
Double-check for leading or trailing spaces in the env var. Vercel sometimes adds
whitespace if you paste with line breaks. Copy the value, paste it into a text editor,
confirm it looks right, then save it again in Vercel and redeploy.

**Dashboard loads but shows no data**
This is normal on a fresh instance. Complete the onboarding checklist and connect
an agent. Data appears as soon as an agent sends its first action.

**Tables were not created automatically**
Visit `/setup` first. If the Database section shows missing core tables, the page will
tell you exactly which tables are absent and which migration commands to run. Use the
proof download on that page if you need a shareable verification snapshot, or check
`/api/health` for a machine-readable status response.
