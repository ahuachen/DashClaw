import { redirect } from 'next/navigation';

/**
 * Redirect /setup to /settings.
 * Preserves the ?proof= query param for live verification proof flow.
 */
export default async function SetupRedirect({ searchParams }) {
  const resolvedSearchParams = await searchParams;
  const proof = typeof resolvedSearchParams?.proof === 'string' ? resolvedSearchParams.proof : '';
  if (proof) {
    redirect(`/settings?proof=${encodeURIComponent(proof)}`);
  }
  redirect('/settings');
}
