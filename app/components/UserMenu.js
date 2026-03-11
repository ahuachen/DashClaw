'use client';

import { useState, useRef, useEffect } from 'react';
import { useSession, signOut } from 'next-auth/react';
import Image from 'next/image';
import { LogOut, User } from 'lucide-react';
import { isDemoMode } from '../lib/isDemoMode';
import { resetAllTips } from './HelpIcon';

export default function UserMenu() {
  const isDemo = isDemoMode();
  const { data: session, status } = useSession();
  const [open, setOpen] = useState(false);
  const menuRef = useRef(null);

  useEffect(() => {
    function handleClickOutside(e) {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setOpen(false);
      }
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  if (status === 'loading') {
    return <div className="w-8 h-8 rounded-full bg-zinc-800 animate-pulse" />;
  }

  const { user } = session || { user: { name: 'Local Admin', email: 'Admin Mode' } };

  return (
    <div className="relative" ref={menuRef}>
      <button
        onClick={() => setOpen(!open)}
        className="flex items-center gap-2 rounded-full hover:ring-2 hover:ring-zinc-600 transition-all"
      >
        {user.image ? (
          <Image
            src={user.image}
            alt={user.name || 'User'}
            width={32}
            height={32}
            className="rounded-full"
            referrerPolicy="no-referrer"
          />
        ) : (
          <div className="w-8 h-8 rounded-full bg-zinc-700 flex items-center justify-center">
            <User size={16} className="text-zinc-400" />
          </div>
        )}
      </button>

      {open && (
        <div className="absolute right-0 top-full mt-2 w-56 rounded-lg bg-[#1a1a1a] border border-[rgba(255,255,255,0.08)] shadow-xl z-50">
          <div className="px-4 py-3 border-b border-[rgba(255,255,255,0.06)]">
            <p className="text-sm font-medium text-white truncate">{user.name || 'User'}</p>
            <p className="text-xs text-zinc-500 truncate">{user.email}</p>
          </div>
          <div className="p-1.5">
            <button
              onClick={() => { resetAllTips(); window.location.reload(); }}
              className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-md transition-colors"
            >
              Reset Tips
            </button>
          </div>
          {!isDemo && (
            <div className="p-1.5">
              <button
                onClick={async () => {
                  await fetch('/api/auth/local', { method: 'DELETE' });
                  signOut({ callbackUrl: '/' });
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-md transition-colors"
              >
                <LogOut size={14} />
                Sign Out
              </button>
            </div>
          )}
          {isDemo && (
            <div className="p-1.5">
              {/* Cookie-based demo: user can exit back to real mode.
                  Env-based demo (NEXT_PUBLIC_DASHCLAW_MODE=demo): no real mode exists. */}
              {process.env.NEXT_PUBLIC_DASHCLAW_MODE === 'demo' ? (
                <div className="px-3 py-2 text-xs text-zinc-500">
                  Demo mode — read-only with sample data.
                </div>
              ) : (
                <button
                  onClick={() => {
                    document.cookie = 'dashclaw_demo=; path=/; max-age=0';
                    window.location.href = '/';
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-sm text-zinc-400 hover:text-white hover:bg-[rgba(255,255,255,0.06)] rounded-md transition-colors"
                >
                  <LogOut size={14} />
                  Exit Demo
                </button>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
