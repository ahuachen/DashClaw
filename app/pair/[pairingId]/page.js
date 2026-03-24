import { redirect } from 'next/navigation';

export default async function PairRedirectPage({ params }) {
  const { pairingId } = await params;
  redirect(`/settings?tab=identity&pairing=${encodeURIComponent(pairingId)}`);
}
