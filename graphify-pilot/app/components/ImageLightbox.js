'use client';

import { useCallback, useEffect } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ImageLightbox({ items, index, onChangeIndex, onClose }) {
  const safeIndex = Math.max(0, Math.min(index ?? 0, (items?.length || 1) - 1));
  const item = items?.[safeIndex];

  const prev = useCallback(() => {
    if (!items?.length) return;
    onChangeIndex((safeIndex - 1 + items.length) % items.length);
  }, [items, onChangeIndex, safeIndex]);

  const next = useCallback(() => {
    if (!items?.length) return;
    onChangeIndex((safeIndex + 1) % items.length);
  }, [items, onChangeIndex, safeIndex]);

  const close = useCallback(() => {
    onClose?.();
  }, [onClose]);

  useEffect(() => {
    if (!item) return;

    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (e) => {
      if (e.key === 'Escape') close();
      if (e.key === 'ArrowLeft') prev();
      if (e.key === 'ArrowRight') next();
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [item, close, prev, next]);

  if (!item) return null;

  return (
    <div
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl cursor-zoom-out"
      onClick={close}
      role="dialog"
      aria-modal="true"
    >
      <button
        onClick={(e) => { e.stopPropagation(); close(); }}
        className="absolute top-5 right-5 z-[210] p-2 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
        aria-label="Close"
      >
        <X size={18} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); prev(); }}
        className="absolute left-4 top-1/2 -translate-y-1/2 z-[210] p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
        aria-label="Previous"
      >
        <ChevronLeft size={26} />
      </button>

      <button
        onClick={(e) => { e.stopPropagation(); next(); }}
        className="absolute right-4 top-1/2 -translate-y-1/2 z-[210] p-3 rounded-full bg-white/5 hover:bg-white/10 text-white transition-colors"
        aria-label="Next"
      >
        <ChevronRight size={26} />
      </button>

      <div className="absolute inset-0 flex items-center justify-center p-4 sm:p-8">
        <div className="w-[min(94vw,1600px)]">
          <div className="relative w-full h-[min(78vh,900px)]">
            <Image
              src={item.src}
              alt={item.alt || item.title || 'Screenshot'}
              fill
              sizes="100vw"
              priority
              className="object-contain rounded-lg shadow-2xl"
            />
          </div>

          {(item.title || item.description) && (
            <div
              className="mt-6 text-center max-w-3xl mx-auto"
              onClick={(e) => e.stopPropagation()}
            >
              {item.title && <h2 className="text-xl font-semibold text-white">{item.title}</h2>}
              {item.description && <p className="mt-2 text-sm text-zinc-400">{item.description}</p>}
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-zinc-500">
                {safeIndex + 1} of {items.length} · Use ← → keys
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

