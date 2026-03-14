import { NextResponse } from 'next/server';
import { neon } from '@neondatabase/serverless';

export const dynamic = 'force-dynamic';

// SECURITY: Allowlist of domains for SSRF prevention
const ALLOWED_URL_PATTERNS = {
  DATABASE_URL: /^postgres(ql)?:\/\/[^@]+@[^/]*\.neon\.tech\//,
  SUPABASE_URL: /^https:\/\/[a-z0-9]+\.supabase\.co$/,
};

function isPrivateIP(hostname) {
  return /^(127\.|10\.|172\.(1[6-9]|2\d|3[01])\.|192\.168\.|169\.254\.|0\.|localhost|::1|\[::1\])/i.test(hostname);
}

function validateUrl(url, type) {
  if (!url || typeof url !== 'string') return false;
  try {
    const parsed = new URL(url);
    if (isPrivateIP(parsed.hostname)) return false;
    if (ALLOWED_URL_PATTERNS[type]) return ALLOWED_URL_PATTERNS[type].test(url);
    return parsed.protocol === 'https:';
  } catch {
    // DATABASE_URL uses postgres:// protocol which URL() may not parse
    if (type === 'DATABASE_URL') return ALLOWED_URL_PATTERNS.DATABASE_URL.test(url);
    return false;
  }
}

/**
 * SECURITY: Standardized fetch wrapper for connection tests to prevent SSRF via redirects.
 */
async function safeFetch(url, options = {}) {
  // Enforce HTTPS
  if (!url.startsWith('https://')) {
    throw new Error('Connection test URLs must use HTTPS');
  }

  // Parse and check for private IPs
  const parsed = new URL(url);
  if (isPrivateIP(parsed.hostname)) {
    throw new Error('Internal or private URLs are not allowed');
  }

  return fetch(url, {
    ...options,
    redirect: 'manual', // Prevent SSRF via redirects
  });
}

// POST - Test a connection with provided credentials (admin only)
export async function POST(request) {
  try {
    // SECURITY: Only admins can test credentials
    const orgRole = request.headers.get('x-org-role');
    if (orgRole !== 'admin') {
      return NextResponse.json({ error: 'Admin access required' }, { status: 403 });
    }

    const body = await request.json();
    const { integration, credentials } = body;

    switch (integration) {
      case 'neon':
        return await testNeon(credentials);
      case 'supabase':
        return await testSupabase(credentials);
      case 'notion':
        return await testNotion(credentials);
      case 'github':
        return await testGitHub(credentials);
      case 'openai':
        return await testOpenAI(credentials);
      case 'anthropic':
        return await testAnthropic(credentials);
      case 'groq':
        return await testGroq(credentials);
      case 'together':
        return await testTogether(credentials);
      case 'replicate':
        return await testReplicate(credentials);
      case 'brave':
        return await testBrave(credentials);
      case 'elevenlabs':
        return await testElevenLabs(credentials);
      case 'discord':
        return await testDiscord(credentials);
      case 'slack':
        return await testSlack(credentials);
      case 'linear':
        return await testLinear(credentials);
      case 'resend':
        return await testResend(credentials);
      case 'stripe':
        return await testStripe(credentials);
      case 'cloudflare':
        return await testCloudflare(credentials);
      case 'vercel':
        return await testVercel(credentials);
      default:
        // Generic "has value" test for integrations without specific test endpoints
        const hasValues = Object.values(credentials || {}).some(v => v && v.length > 0);
        if (hasValues) {
          return NextResponse.json({ 
            success: true, 
            message: 'Credentials saved (connection not verified)' 
          });
        }
        return NextResponse.json({ 
          success: false, 
          message: 'Please enter credentials' 
        });
    }
  } catch (error) {
    console.error('Settings test error:', error);
    return NextResponse.json({
      success: false,
      message: 'Connection test failed'
    }, { status: 500 });
  }
}

async function testNeon(credentials) {
  try {
    if (!validateUrl(credentials.DATABASE_URL, 'DATABASE_URL')) {
      return NextResponse.json({ success: false, message: 'Invalid database URL. Must be a Neon PostgreSQL connection string.' });
    }
    const sql = neon(credentials.DATABASE_URL);
    await sql`SELECT 1 as test`;
    return NextResponse.json({ success: true, message: 'Database connection successful!' });
  } catch (error) {
    console.error('Neon test error:', error);
    return NextResponse.json({ success: false, message: 'Database connection failed' });
  }
}

async function testNotion(credentials) {
  try {
    const res = await safeFetch('https://api.notion.com/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${credentials.NOTION_API_KEY}`,
        'Notion-Version': '2022-06-28'
      }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected as ${data.name || 'Notion user'}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid Notion API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testGitHub(credentials) {
  try {
    const res = await safeFetch('https://api.github.com/user', {
      headers: {
        'Authorization': `Bearer ${credentials.GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected as @${data.login}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid GitHub token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testOpenAI(credentials) {
  try {
    const res = await safeFetch('https://api.openai.com/v1/models', {
      headers: { 'Authorization': `Bearer ${credentials.OPENAI_API_KEY}` }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'OpenAI API key valid!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid OpenAI API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testAnthropic(credentials) {
  try {
    // Anthropic doesn't have a simple auth check endpoint, so we just verify format
    if (credentials.ANTHROPIC_API_KEY?.startsWith('sk-ant-')) {
      return NextResponse.json({ success: true, message: 'API key format valid' });
    }
    return NextResponse.json({ success: false, message: 'Invalid API key format (should start with sk-ant-)' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testBrave(credentials) {
  try {
    const res = await safeFetch('https://api.search.brave.com/res/v1/web/search?q=test', {
      headers: { 'X-Subscription-Token': credentials.BRAVE_API_KEY }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Brave Search API connected!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Brave API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testElevenLabs(credentials) {
  try {
    const res = await safeFetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': credentials.ELEVENLABS_API_KEY }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected! ${data.subscription?.character_count || 0} chars remaining` });
    }
    return NextResponse.json({ success: false, message: 'Invalid ElevenLabs API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testSupabase(credentials) {
  try {
    const rawUrl = credentials?.SUPABASE_URL;

    if (typeof rawUrl !== 'string' || rawUrl.length === 0) {
      return NextResponse.json({ success: false, message: 'Invalid Supabase URL. Must be https://<project>.supabase.co' });
    }

    let parsed;
    try {
      parsed = new URL(rawUrl);
    } catch {
      return NextResponse.json({ success: false, message: 'Invalid Supabase URL. Must be https://<project>.supabase.co' });
    }

    const hostname = parsed.hostname;
    const protocol = parsed.protocol;

    // Enforce https and public Supabase project hostnames only
    const supabaseHostPattern = /^[a-z0-9]+\.supabase\.co$/;
    if (
      protocol !== 'https:' ||
      !supabaseHostPattern.test(hostname) ||
      isPrivateIP(hostname)
    ) {
      return NextResponse.json({ success: false, message: 'Invalid Supabase URL. Must be https://<project>.supabase.co' });
    }

    // Reconstruct a safe origin to avoid carrying over any attacker-controlled path/query
    const safeOrigin = `https://${hostname}`;

    const res = await safeFetch(`${safeOrigin}/rest/v1/`, {
      headers: {
        'apikey': credentials.SUPABASE_ANON_KEY,
        'Authorization': `Bearer ${credentials.SUPABASE_ANON_KEY}`
      }
    });
    if (res.ok || res.status === 200) {
      return NextResponse.json({ success: true, message: 'Supabase connection successful!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Supabase credentials' });
  } catch (error) {
    console.error('Supabase test error:', error);
    return NextResponse.json({ success: false, message: 'Supabase connection failed' });
  }
}

async function testGroq(credentials) {
  try {
    const res = await safeFetch('https://api.groq.com/openai/v1/models', {
      headers: { 'Authorization': `Bearer ${credentials.GROQ_API_KEY}` }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Groq API key valid!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Groq API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testTogether(credentials) {
  try {
    const res = await safeFetch('https://api.together.xyz/v1/models', {
      headers: { 'Authorization': `Bearer ${credentials.TOGETHER_API_KEY}` }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Together AI connected!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Together API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testReplicate(credentials) {
  try {
    const res = await safeFetch('https://api.replicate.com/v1/account', {
      headers: { 'Authorization': `Token ${credentials.REPLICATE_API_TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected as ${data.username}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid Replicate token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testDiscord(credentials) {
  try {
    const res = await safeFetch('https://discord.com/api/v10/users/@me', {
      headers: { 'Authorization': `Bot ${credentials.DISCORD_BOT_TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected as ${data.username}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid Discord bot token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testSlack(credentials) {
  try {
    const res = await safeFetch('https://slack.com/api/auth.test', {
      headers: { 'Authorization': `Bearer ${credentials.SLACK_BOT_TOKEN}` }
    });
    const data = await res.json();
    if (data.ok) {
      return NextResponse.json({ success: true, message: `Connected to ${data.team}` });
    }
    return NextResponse.json({ success: false, message: data.error || 'Invalid Slack token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testLinear(credentials) {
  try {
    const res = await safeFetch('https://api.linear.app/graphql', {
      method: 'POST',
      headers: { 
        'Authorization': credentials.LINEAR_API_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ query: '{ viewer { id name } }' })
    });
    const data = await res.json();
    if (data.data?.viewer) {
      return NextResponse.json({ success: true, message: `Connected as ${data.data.viewer.name}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid Linear API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testResend(credentials) {
  try {
    const res = await safeFetch('https://api.resend.com/domains', {
      headers: { 'Authorization': `Bearer ${credentials.RESEND_API_KEY}` }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Resend API connected!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Resend API key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testStripe(credentials) {
  try {
    const res = await safeFetch('https://api.stripe.com/v1/balance', {
      headers: { 'Authorization': `Bearer ${credentials.STRIPE_SECRET_KEY}` }
    });
    if (res.ok) {
      return NextResponse.json({ success: true, message: 'Stripe connected!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Stripe secret key' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testCloudflare(credentials) {
  try {
    const res = await safeFetch('https://api.cloudflare.com/client/v4/user/tokens/verify', {
      headers: { 'Authorization': `Bearer ${credentials.CLOUDFLARE_API_TOKEN}` }
    });
    const data = await res.json();
    if (data.success) {
      return NextResponse.json({ success: true, message: 'Cloudflare token valid!' });
    }
    return NextResponse.json({ success: false, message: 'Invalid Cloudflare token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}

async function testVercel(credentials) {
  try {
    const res = await safeFetch('https://api.vercel.com/v2/user', {
      headers: { 'Authorization': `Bearer ${credentials.VERCEL_TOKEN}` }
    });
    if (res.ok) {
      const data = await res.json();
      return NextResponse.json({ success: true, message: `Connected as ${data.user?.username || 'Vercel user'}` });
    }
    return NextResponse.json({ success: false, message: 'Invalid Vercel token' });
  } catch (error) {
    return NextResponse.json({ success: false, message: 'Connection test failed' });
  }
}
