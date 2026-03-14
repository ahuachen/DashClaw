import PairApprovalClient from './pairApprovalClient';

export default function PairPage({ params }) {
  return <PairApprovalClient pairingId={params.pairingId} />;
}

