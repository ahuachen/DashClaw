'use client';

import { useState } from 'react';
import Image from 'next/image';
import ImageLightbox from './ImageLightbox';

export default function HeroScreenshot({ src, alt, className = '', items = [] }) {
  const [open, setOpen] = useState(false);
  const [currentIndex, setCurrentIndex] = useState(0);

  const galleryItems = items.length > 0 ? items : [{ src, alt, title: '' }];
  
  const handleOpen = () => {
    // If items provided, find initial index
    if (items.length > 0) {
      const idx = items.findIndex(item => item.src === src);
      setCurrentIndex(idx !== -1 ? idx : 0);
    } else {
      setCurrentIndex(0);
    }
    setOpen(true);
  };

  return (
    <>
      <div
        className={`relative aspect-[16/10] overflow-hidden rounded-xl border border-[rgba(255,255,255,0.08)] bg-[#111] cursor-zoom-in ${className}`}
        onClick={handleOpen}
        role="button"
        tabIndex={0}
        aria-label="View fullscreen"
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') handleOpen(); }}
      >
        <Image
          src={src}
          alt={alt}
          fill
          sizes="(max-width: 1024px) 100vw, 60vw"
          priority
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/0 hover:bg-black/10 transition-colors" />
      </div>

      {open && (
        <ImageLightbox
          items={galleryItems}
          index={currentIndex}
          onChangeIndex={setCurrentIndex}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}
