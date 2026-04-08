'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import ImageLightbox from './ImageLightbox';

export default function ImageCarousel({
  items,
  initialIndex = 0,
  autoRotateMs = 0,
  aspectClassName = 'aspect-[16/10]',
  sizes = '(max-width: 768px) 100vw, 900px',
  priority = false,
  className = '',
  imageClassName = 'object-cover',
  showCaption = true,
}) {
  const safeItems = items || [];
  const [index, setIndex] = useState(initialIndex);
  const [open, setOpen] = useState(false);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    setIndex(initialIndex);
  }, [initialIndex]);

  const safeIndex = useMemo(() => {
    if (!safeItems.length) return 0;
    return Math.max(0, Math.min(index, safeItems.length - 1));
  }, [index, safeItems.length]);

  const prev = useCallback(() => {
    if (!safeItems.length) return;
    setIndex((i) => (i - 1 + safeItems.length) % safeItems.length);
  }, [safeItems.length]);

  const next = useCallback(() => {
    if (!safeItems.length) return;
    setIndex((i) => (i + 1) % safeItems.length);
  }, [safeItems.length]);

  const item = safeItems[safeIndex];

  useEffect(() => {
    if (!autoRotateMs) return;
    if (paused) return;
    if (open) return;
    if (safeItems.length <= 1) return;

    const t = setInterval(() => {
      setIndex((i) => (i + 1) % safeItems.length);
    }, autoRotateMs);
    return () => clearInterval(t);
  }, [autoRotateMs, paused, open, safeItems.length]);

  if (!item) return null;

  return (
    <>
      <div
        className={`relative ${aspectClassName} overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] ${className}`}
        onMouseEnter={() => setPaused(true)}
        onMouseLeave={() => setPaused(false)}
        onFocus={() => setPaused(true)}
        onBlur={() => setPaused(false)}
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') prev();
          if (e.key === 'ArrowRight') next();
          if (e.key === 'Enter' || e.key === ' ') setOpen(true);
        }}
        role="group"
        aria-label="Screenshot carousel"
      >
        <button
          onClick={(e) => { e.stopPropagation(); prev(); }}
          className="absolute left-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white transition-colors"
          aria-label="Previous screenshot"
        >
          <ChevronLeft size={18} />
        </button>

        <button
          onClick={(e) => { e.stopPropagation(); next(); }}
          className="absolute right-3 top-1/2 -translate-y-1/2 z-10 p-2 rounded-full bg-black/40 hover:bg-black/60 border border-white/10 text-white transition-colors"
          aria-label="Next screenshot"
        >
          <ChevronRight size={18} />
        </button>

        <div
          className="absolute inset-0 cursor-zoom-in"
          onClick={() => setOpen(true)}
          aria-label="Open fullscreen"
        >
          <Image
            src={item.src}
            alt={item.alt || item.title || 'Screenshot'}
            fill
            sizes={sizes}
            priority={priority}
            className={`${imageClassName} transition-transform duration-700`}
          />
          <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
        </div>

        {showCaption && (item.title || item.description) && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent p-4">
            {item.title && <div className="text-sm font-semibold text-white">{item.title}</div>}
            {item.description && <div className="mt-0.5 text-xs text-zinc-300">{item.description}</div>}
          </div>
        )}

        {safeItems.length > 1 && (
          <div className="pointer-events-none absolute top-3 left-3 z-10 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-black/35 border border-white/10 text-[11px] text-zinc-200">
            {safeIndex + 1} / {safeItems.length}
          </div>
        )}
      </div>

      {open && (
        <ImageLightbox
          items={safeItems}
          index={safeIndex}
          onChangeIndex={setIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

