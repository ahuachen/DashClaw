import { getToken } from 'next-auth/jwt';
import { jwtVerify } from 'jose';

export const LOCAL_SESSION_COOKIE = 'dashclaw-local-session';

function getCookieValue(cookieHeader, key) {
  const parts = String(cookieHeader || '').split(/;\s*/);
  for (const part of parts) {
    const [name, ...rest] = part.split('=');
    if (name === key) {
      return rest.join('=');
    }
  }
  return '';
}

async function getNextAuthViewer(cookieHeader, env) {
  if (!env.NEXTAUTH_SECRET) return null;

  // getToken infers secureCookie from req.url / x-forwarded-proto; we pass a
  // cookies-only shim (no URL), so it defaults to the non-secure cookie name
  // and misses `__Secure-next-auth.session-token` on HTTPS. Try the secure
  // name first (Vercel / any HTTPS deploy), then fall back to the plain name
  // (local http dev) so we cover both without depending on NEXTAUTH_URL.
  const req = { headers: { cookie: cookieHeader || '' } };
  for (const secureCookie of [true, false]) {
    try {
      const token = await getToken({
        req,
        secret: env.NEXTAUTH_SECRET,
        secureCookie,
      });
      if (token) {
        return {
          isAuthenticated: true,
          authType: 'nextauth',
          session: token,
        };
      }
    } catch {
      // try the other name
    }
  }
  return null;
}

async function getLocalViewer(cookieHeader, env) {
  const token = getCookieValue(cookieHeader, LOCAL_SESSION_COOKIE);
  if (!token || !env.NEXTAUTH_SECRET) return null;

  try {
    const secret = new TextEncoder().encode(env.NEXTAUTH_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload.provider !== 'local') return null;

    return {
      isAuthenticated: true,
      authType: 'local',
      session: payload,
    };
  } catch {
    return null;
  }
}

export async function getViewerContextFromCookieHeader(cookieHeader, env = process.env) {
  const nextAuthViewer = await getNextAuthViewer(cookieHeader, env);
  if (nextAuthViewer) return nextAuthViewer;

  const localViewer = await getLocalViewer(cookieHeader, env);
  if (localViewer) return localViewer;

  return {
    isAuthenticated: false,
    authType: null,
    session: null,
  };
}
