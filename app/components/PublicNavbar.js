'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Github, Menu, X } from 'lucide-react';
import DashClawLogo from './DashClawLogo';

export default function PublicNavbar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

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
            Mission Control
          </Link>
          <Link href="/self-host" className="hidden sm:inline-flex px-4 py-1.5 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] text-zinc-300 text-sm font-medium hover:bg-[#222] hover:text-white transition-colors">
            Get Started
          </Link>
          <button
            type="button"
            onClick={() => setMobileOpen(true)}
            aria-label="Open navigation menu"
            aria-expanded={mobileOpen}
            className="sm:hidden inline-flex items-center justify-center rounded-lg border border-[rgba(255,255,255,0.1)] bg-[#1a1a1a] p-2 text-zinc-300 transition-colors hover:bg-[#222] hover:text-white"
          >
            <Menu size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-50 sm:hidden">
          <div
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={closeMobile}
            aria-hidden="true"
          />
          <div className="absolute right-0 top-0 bottom-0 flex w-72 max-w-[85vw] flex-col border-l border-[rgba(255,255,255,0.06)] bg-[#0a0a0a]">
            <div className="flex items-center justify-between border-b border-[rgba(255,255,255,0.06)] px-5 py-4">
              <span className="text-xs font-semibold uppercase tracking-[0.14em] text-zinc-500">Menu</span>
              <button
                type="button"
                onClick={closeMobile}
                aria-label="Close navigation menu"
                className="rounded p-1.5 text-zinc-400 transition-colors hover:bg-white/5 hover:text-white"
              >
                <X size={18} aria-hidden="true" />
              </button>
            </div>
            <div className="flex flex-1 flex-col gap-1 overflow-y-auto px-3 py-4">
              <Link href="/#features" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                Features
              </Link>
              <Link href="/gallery" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                Gallery
              </Link>
              <Link href="/connect" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                Connect an Agent
              </Link>
              <Link href="/docs" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                Docs
              </Link>
              <Link href="/practical-systems" onClick={closeMobile} className="rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white">
                Practical Systems
              </Link>
              <a
                href="https://github.com/ucsandman/DashClaw"
                target="_blank"
                rel="noopener noreferrer"
                onClick={closeMobile}
                className="inline-flex items-center gap-2 rounded-lg px-3 py-2.5 text-sm text-zinc-300 transition-colors hover:bg-white/5 hover:text-white"
              >
                <Github size={14} aria-hidden="true" /> GitHub
              </a>
            </div>
            <div className="border-t border-[rgba(255,255,255,0.06)] px-5 py-4">
              <Link
                href="/self-host"
                onClick={closeMobile}
                className="block w-full rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] px-4 py-2 text-center text-sm font-medium text-zinc-200 transition-colors hover:bg-[#222] hover:text-white"
              >
                Get Started
              </Link>
            </div>
          </div>
        </div>
      )}
    </nav>
  );
}
