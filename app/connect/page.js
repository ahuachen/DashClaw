import { headers } from 'next/headers';
import Link from 'next/link';
import { ChevronRight } from 'lucide-react';

import PublicNavbar from '../components/PublicNavbar';
import PublicFooter from '../components/PublicFooter';
import ConnectGuideClient from './ConnectGuideClient';
import { getConnectGuideContent } from '../lib/connectGuide.js';

export const dynamic = 'force-dynamic';

export const metadata = {
  title: 'Connect your first agent - DashClaw',
  description:
    'Canonical golden path for connecting a real Node or Python agent to DashClaw and validating the first live action.',
};

export default async function ConnectPage() {
  const headerStore = await headers();
  const host = headerStore.get('host') || 'localhost:3000';
  const content = getConnectGuideContent({ host });

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white">
      <PublicNavbar />

      <main className="px-6 pb-20 pt-28">
        <div className="mx-auto max-w-5xl">
          <div className="mb-8 flex items-center gap-2 text-sm text-zinc-500">
            <Link href="/" className="transition-colors hover:text-zinc-300">
              Home
            </Link>
            <ChevronRight size={14} />
            <span className="text-zinc-300">Connect your first agent</span>
          </div>

          <ConnectGuideClient content={content} />
        </div>
      </main>

      <PublicFooter />
    </div>
  );
}

