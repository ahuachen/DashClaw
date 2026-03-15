'use client';

import { useMemo, useState, useEffect } from 'react';
import { Search, History } from 'lucide-react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';

export default function DocsSidebarClient({ items }) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const pathname = usePathname();
  
  const [query, setQuery] = useState('');
  const normalizedQuery = query.trim().toLowerCase();

  const showLegacy = searchParams.get('legacy') === 'true';

  const toggleLegacy = (checked) => {
    const params = new URLSearchParams(searchParams.toString());
    if (checked) {
      params.set('legacy', 'true');
    } else {
      params.delete('legacy');
    }
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const filtered = useMemo(() => {
    const baseItems = showLegacy ? items : items.filter(item => !item.legacy);
    
    if (!normalizedQuery) return baseItems;
    return baseItems.filter((item) => {
      const label = String(item.label || '').toLowerCase();
      const href = String(item.href || '').toLowerCase();
      return label.includes(normalizedQuery) || href.includes(normalizedQuery);
    });
  }, [items, normalizedQuery, showLegacy]);

  return (
    <nav className="hidden lg:block sticky top-24 w-56 shrink-0 self-start max-h-[calc(100vh-120px)] overflow-y-auto pr-4 scrollbar-hide hover:scrollbar-default transition-all">
      <div className="mb-3">
        <div className="text-xs text-zinc-500 font-medium uppercase tracking-wider mb-2">On this page</div>
        <div className="relative mb-3">
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search methods…"
            className="w-full rounded-full border border-[rgba(255,255,255,0.12)] bg-[#090909] px-3 py-1.5 pr-8 text-xs text-zinc-200 placeholder:text-zinc-500 focus:outline-none focus:ring-1 focus:ring-brand"
          />
          <Search
            size={14}
            className="pointer-events-none absolute right-2.5 top-1/2 -translate-y-1/2 text-zinc-500"
          />
        </div>

        <label className="flex items-center gap-2 px-1 py-1 cursor-pointer group">
          <div className="relative inline-flex items-center cursor-pointer">
            <input 
              type="checkbox" 
              className="sr-only peer" 
              checked={showLegacy}
              onChange={(e) => toggleLegacy(e.target.checked)}
            />
            <div className="w-7 h-4 bg-zinc-800 peer-focus:outline-none rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-zinc-400 after:border-zinc-300 after:border after:rounded-full after:h-3 after:w-3 after:transition-all peer-checked:bg-brand/60 peer-checked:after:bg-white"></div>
          </div>
          <span className="text-[11px] font-medium text-zinc-500 group-hover:text-zinc-300 transition-colors flex items-center gap-1.5">
            <History size={12} />
            Show Legacy (v1)
          </span>
        </label>
      </div>

      <ul className="space-y-1.5 text-sm pb-8">
        {filtered.map((item) => (
          <li key={item.href}>
            <a
              href={item.href}
              className={`block truncate text-zinc-400 hover:text-white transition-colors ${
                item.indent ? 'pl-3 text-xs' : ''
              }`}
              title={item.label}
            >
              {item.label}
            </a>
          </li>
        ))}
        {filtered.length === 0 && (
          <li className="pt-2 text-[11px] text-zinc-500">No matches. Try a different name.</li>
        )}
      </ul>
    </nav>
  );
}

