'use client';

import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import ImageLightbox from '../components/ImageLightbox';
import Image from 'next/image';
import { useMemo, useState, useEffect, Suspense } from 'react';
import { allScreenshots } from '../screenshotData';

const descriptions = {
  'Interception Replay': 'Visual causal chains that explain exactly why an agent chose an action and how it was governed.',
  'Mission Control': 'Strategic overview: fleet health, active interventions, risk signals, and cost velocity.',
  'Decisions': 'The permanent ledger of every governed agent decision, complete with evidence and identity proofs.',
  'Policies': 'Semantic guardrails that define what agents can and cannot do without code changes.',
  'Approvals': 'Human-in-the-loop queue for high-risk agent actions requiring manual oversight.',
  'Agents': 'Comprehensive inventory of your agent fleet, including connectivity status and posture.',
  'Signals': 'Automated detection of autonomy spikes, drift, loops, and security violations.',
  'Activity': 'System-wide audit trail of all workspace changes and administrative events.',
  'Compliance': 'Real-time mapping of agent behavior to regulatory frameworks like SOC 2 and ISO 27001.',
  'Audit Log': 'Immutable record of system integrity signals and governance events.',
  'Swarm Intel': 'Visualization of multi-agent communication patterns and emergent swarm risks.',
  'Assumptions': 'Tracks the beliefs and assumptions agents rely on to detect reasoning drift.',
  'Learning': 'Analytics on agent effectiveness and automated recommendations for policy tuning.',
  'Prompts': 'Governance over the raw prompts and system instructions that drive agent behavior.',
  'Evaluations': 'Automated quality scoring using regex, numeric ranges, and LLM-as-a-Judge.',
  'Quality Scoring': 'Composite performance metrics that combine risk, confidence, and efficiency.',
  'Integrations': 'Secure connection management for AI providers, databases, and third-party APIs.',
  'Webhooks': 'Real-time exfiltration of governance events to your existing alerting stack.',
  'API Keys': 'Manage scoped credentials for connecting your agents to the DashClaw runtime.',
  'Usage': 'Granular tracking of token consumption and cost-per-decision across the fleet.',
  'Settings': 'Global workspace configuration, security headers, and identity provider settings.',
};

function GalleryContent() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [selectedIndex, setSelectedIndex] = useState(null);

  const galleryItems = useMemo(() => {
    return allScreenshots.map((s) => ({
      ...s,
      description: descriptions[s.title] || '',
    }));
  }, []);

  useEffect(() => {
    const v = searchParams.get('v');
    if (v !== null) {
      // Try to find by index first
      let idx = parseInt(v);
      if (isNaN(idx)) {
        // Try to find by filename
        idx = allScreenshots.findIndex(s => s.src.includes(v));
      }
      
      if (idx >= 0 && idx < allScreenshots.length) {
        setSelectedIndex(idx);
      }
    }
  }, [searchParams]);

  const handleClose = () => {
    setSelectedIndex(null);
    // Remove query param without full navigation
    router.replace('/gallery', { scroll: false });
  };

  return (
    <div className="min-h-screen bg-surface-primary text-white">
      <PublicNavbar />

      <main className="mx-auto max-w-6xl px-6 pb-20 pt-28">
        <div className="mb-8 flex items-center gap-3">
          <Link
            href="/"
            className="rounded-lg border border-border bg-surface-tertiary p-2 text-zinc-400 transition-colors hover:border-border-hover hover:text-white"
            aria-label="Back to home"
          >
            <ArrowLeft size={18} aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-3xl font-semibold tracking-tight">Product gallery</h1>
            <p className="mt-1 text-sm text-zinc-400">
              Click any image to view fullscreen. Use ← → keys or the arrows to browse. Click anywhere to close.
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 md:grid-cols-2">
          {galleryItems.map((s, idx) => (
            <button
              key={s.src}
              className="group flex cursor-zoom-in flex-col gap-3 text-left focus:outline-none"
              onClick={() => setSelectedIndex(idx)}
              aria-label={`View ${s.title} fullscreen`}
            >
              <div className="relative aspect-[16/10] overflow-hidden rounded-xl border border-border bg-surface-secondary transition-colors group-hover:border-border-hover group-focus-visible:ring-2 group-focus-visible:ring-brand/40">
                <Image
                  src={s.src}
                  alt={s.alt}
                  fill
                  sizes="(max-width: 768px) 100vw, 50vw"
                  className="object-cover transition-transform duration-500 group-hover:scale-[1.01]"
                />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-white">{s.title}</h3>
                <p className="mt-1 text-sm leading-relaxed text-zinc-400">{s.description}</p>
              </div>
            </button>
          ))}
        </div>
      </main>

      {selectedIndex !== null && (
        <ImageLightbox
          items={galleryItems}
          index={selectedIndex}
          onChangeIndex={setSelectedIndex}
          onClose={handleClose}
        />
      )}

      <PublicFooter />
    </div>
  );
}

export default function GalleryPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-surface-primary" />}>
      <GalleryContent />
    </Suspense>
  );
}
