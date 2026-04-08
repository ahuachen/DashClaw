'use client';

import { useRealtime } from '../hooks/useRealtime';
import { Wifi } from 'lucide-react';

export default function RealtimeIndicator() {
  // Just hooking into it keeps the connection alive
  useRealtime(() => {});

  return (
    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20">
      <Wifi size={12} className="text-emerald-500 animate-pulse" />
      <span className="text-[10px] font-medium text-emerald-500">LIVE</span>
    </div>
  );
}
