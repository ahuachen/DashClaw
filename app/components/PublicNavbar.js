'use client';

import Link from 'next/link';
import { Github } from 'lucide-react';
import DashClawLogo from './DashClawLogo';

export default function PublicNavbar() {
  return (
    <nav className="fixed top-0 w-full z-50 border-b border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]/80 backdrop-blur-sm">
      <div className="max-w-6xl mx-auto px-6 h-14 flex items-center justify-between">
        <Link href="/" className="flex items-center gap-2.5 hover:opacity-90 transition-opacity">
          <DashClawLogo size={20} />
          <span className="text-lg font-semibold text-white">DashClaw</span>
        </Link>
        <div className="hidden sm:flex items-center gap-6 text-sm text-zinc-400">
          <Link href="/#features" className="hover:text-white transition-colors">Features</Link>
          <Link href="/gallery" className="hover:text-white transition-colors">Gallery</Link>
          <Link href="/connect" className="hover:text-white transition-colors">Connect an Agent</Link>
          <Link href="/docs" className="hover:text-white transition-colors">Docs</Link>
          <Link href="/practical-systems" className="hover:text-white transition-colors">Practical Systems</Link>
          <a
            href="https://github.com/ucsandman/DashClaw"
            target="_blank"
            rel="noopener noreferrer"
            className="hover:text-white transition-colors inline-flex items-center gap-1.5"
          >
            <Github size={14} /> GitHub
          </a>
        </div>
        <div className="flex items-center gap-3">
          <Link href="/demo" className="px-4 py-1.5 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors">
            Run Demo
          </Link>
          <Link href="/self-host" className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-zinc-300 text-sm font-medium hover:bg-[#222] hover:text-white transition-colors">
            Get Started
          </Link>
        </div>
      </div>
    </nav>
  );
}
