'use client';

import { useCallback, useEffect, useRef } from 'react';
import Image from 'next/image';
import { ChevronLeft, ChevronRight, X } from 'lucide-react';

export default function ImageLightbox({ items, index, onChangeIndex, onClose }) {
  const safeIndex = Math.max(0, Math.min(index ?? 0, (items?.length || 1) - 1));
  const item = items?.[safeIndex];
  const dialogRef = useRef(null);
  const previouslyFocusedRef = useRef(null);

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

    previouslyFocusedRef.current = document.activeElement;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    // Focus the close button (first focusable) so keyboard users land inside the dialog.
    const focusables = dialogRef.current?.querySelectorAll(
      'a[href], button:not([disabled]), textarea, input, select, [tabindex]:not([tabindex="-1"])'
    );
    focusables?.[0]?.focus();

    const onKeyDown = (e) => {
      if (e.key === 'Escape') { close(); return; }
      if (e.key === 'ArrowLeft') { prev(); return; }
      if (e.key === 'ArrowRight') { next(); return; }
      if (e.key !== 'Tab' || !focusables || focusables.length === 0) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };

    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.body.style.overflow = prevOverflow;
      window.removeEventListener('keydown', onKeyDown);
      previouslyFocusedRef.current?.focus?.();
    };
  }, [item, close, prev, next]);

  if (!item) return null;

  return (
    <div
      ref={dialogRef}
      className="fixed inset-0 z-[200] bg-black/95 backdrop-blur-xl cursor-zoom-out"
      onClick={close}
      role="dialog"
      aria-modal="true"
      aria-label="Image viewer"
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
              {item.description && <p className="mt-2 text-sm text-secondary">{item.description}</p>}
              <div className="mt-3 inline-flex items-center gap-2 px-3 py-1 rounded-full bg-white/5 border border-white/10 text-[11px] text-tertiary">
                {safeIndex + 1} of {items.length} · Use ← → keys
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

