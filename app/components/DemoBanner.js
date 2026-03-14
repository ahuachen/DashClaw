'use client';

import Link from 'next/link';
import { ShieldAlert } from 'lucide-react';
import { isDemoMode } from '../lib/isDemoMode';

export default function DemoBanner() {
  if (!isDemoMode()) return null;

  return (
    <div className="border-b border-[rgba(249,115,22,0.25)] bg-[rgba(249,115,22,0.06)]">
      <div className="px-6 py-2.5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2">
        <div className="flex items-center gap-2 text-xs text-zinc-300">
          <ShieldAlert size={14} className="text-brand" />
          <span className="font-bold text-zinc-100 uppercase tracking-tighter">Demo Mode:</span>
          <span>Simulated data. Deploy your own DashClaw instance to connect real agents.</span>
        </div>
        <div className="flex items-center gap-3 text-xs">
          <Link href="/self-host" className="text-brand hover:text-brand-hover transition-colors">
            Get Started
          </Link>
          <Link href="/" className="text-zinc-400 hover:text-white transition-colors">
            What is DashClaw?
          </Link>
        </div>
      </div>
    </div>
  );
}
