'use client';

import { useState, useEffect, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RotateCw, ShieldAlert } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent } from '../../components/ui/Card';
import { Skeleton } from '../../components/ui/Skeleton';
import AgentVitalsStrip from './components/AgentVitalsStrip';
import AgentTrustPosture from './components/AgentTrustPosture';
import AgentSignals from './components/AgentSignals';
import AgentDecisionTable from './components/AgentDecisionTable';
import AgentAssumptions from './components/AgentAssumptions';
import AgentPoliciesSection from './components/AgentPoliciesSection';

export default function AgentProfilePage() {
  const { agentId } = useParams();
  const decodedAgentId = decodeURIComponent(agentId);

  const [profile, setProfile] = useState(null);
  const [policies, setPolicies] = useState([]);
  const [allPolicies, setAllPolicies] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);

      const [profileRes, agentPoliciesRes, allPoliciesRes] = await Promise.all([
        fetch(`/api/agents/${encodeURIComponent(decodedAgentId)}/profile`),
        fetch(`/api/policies?agent_id=${encodeURIComponent(decodedAgentId)}`),
        fetch('/api/policies'),
      ]);

      if (!profileRes.ok) {
        if (profileRes.status === 404) throw new Error('Agent not found');
        throw new Error('Failed to load profile');
      }

      const profileData = await profileRes.json();
      setProfile(profileData);

      if (agentPoliciesRes.ok) {
        const pData = await agentPoliciesRes.json();
        setPolicies(pData.policies || []);
      }
      if (allPoliciesRes.ok) {
        const aData = await allPoliciesRes.json();
        setAllPolicies(aData.policies || []);
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }, [decodedAgentId]);

  useEffect(() => {
    if (decodedAgentId) fetchProfile();
  }, [decodedAgentId, fetchProfile]);

  if (loading) {
    return (
      <PageLayout title="Agent Profile" breadcrumbs={['Observe', 'Fleet', 'Profile']}>
        <div className="space-y-4 max-w-5xl mx-auto">
          <Skeleton className="h-20 w-full rounded-2xl" />
          <Skeleton className="h-16 w-full rounded-2xl" />
          <Skeleton className="h-64 w-full rounded-2xl" />
        </div>
      </PageLayout>
    );
  }

  if (error || !profile) {
    return (
      <PageLayout title="Agent Not Found" breadcrumbs={['Observe', 'Fleet', decodedAgentId]}>
        <div className="max-w-md mx-auto mt-12 text-center">
          <Card hover={false}>
            <CardContent className="pt-8">
              <ShieldAlert size={32} className="text-zinc-600 mx-auto mb-3" />
              <div className="text-lg font-medium text-white mb-2">{error || 'Agent not found'}</div>
              <Link href="/agents" className="text-brand hover:underline text-sm font-medium">Back to Fleet</Link>
            </CardContent>
          </Card>
        </div>
      </PageLayout>
    );
  }

  return (
    <PageLayout
      title={profile.agent.agent_name}
      breadcrumbs={['Observe', 'Fleet', profile.agent.agent_name]}
      actions={
        <div className="flex items-center gap-2">
          <Link href="/agents" className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-zinc-400 hover:text-white transition-colors">
            <ArrowLeft size={14} /> Fleet
          </Link>
          <button
            onClick={fetchProfile}
            className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg hover:border-[rgba(255,255,255,0.12)] transition-colors"
          >
            <RotateCw size={14} /> Refresh
          </button>
        </div>
      }
    >
      <div className="max-w-5xl mx-auto space-y-6">
        <AgentVitalsStrip
          agent={profile.agent}
          identityVerified={profile.trust.identity_verified}
        />

        <AgentTrustPosture trust={profile.trust} />

        <AgentSignals signals={profile.signals} />

        <AgentDecisionTable agentId={decodedAgentId} />

        <AgentAssumptions
          agentId={decodedAgentId}
          summary={profile.assumptions_summary}
        />

        <AgentPoliciesSection
          agentId={decodedAgentId}
          policies={policies}
          allPolicies={allPolicies}
          onRefresh={fetchProfile}
        />
      </div>
    </PageLayout>
  );
}
