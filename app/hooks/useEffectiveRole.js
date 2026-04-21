'use client';

import { useEffect, useState } from 'react';

// BUG-03b: useSession() from next-auth only reads the NextAuth JWT cookie
// and ignores the `dashclaw-local-session` cookie issued by the local-
// password auth path (POST /api/auth/local). Admin-gated UIs that derived
// `isAdmin` directly from useSession rendered local-admins as read-only.
//
// This hook fetches /api/session/effective (backed by
// getViewerContextFromCookieHeader, which unifies NextAuth + local-session
// resolution) and returns the viewer's effective role. `settled` flips to
// true once the fetch resolves — gate read-only banners on `settled` so
// they don't flash during hydration.
export function useEffectiveRole() {
  const [role, setRole] = useState(null);
  const [settled, setSettled] = useState(false);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/session/effective');
        if (!res.ok) throw new Error(`effective-session ${res.status}`);
        const json = await res.json();
        if (!cancelled) setRole(json.role || null);
      } catch {
        // Leave role null — the caller treats that as non-admin.
      } finally {
        if (!cancelled) setSettled(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { role, isAdmin: role === 'admin', settled };
}
