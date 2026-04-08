'use client';

import { useState } from 'react';
import { Copy, Check } from 'lucide-react';

export default function CopyableCodeBlock({ title, children, copyText }) {
  const [copied, setCopied] = useState(false);

  function handleCopy() {
    const text = copyText ?? (typeof children === 'string' ? children : '');
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <div className="relative group rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] overflow-x-auto">
      {title && (
        <div className="px-5 py-2.5 border-b border-[rgba(255,255,255,0.06)] text-xs text-zinc-500 font-mono">{title}</div>
      )}
      <pre className="p-5 font-mono text-sm leading-relaxed text-zinc-300 whitespace-pre-wrap">{children}</pre>
      <button
        onClick={handleCopy}
        className="absolute top-2 right-2 p-1.5 rounded bg-[#181818] hover:bg-[#222] opacity-0 group-hover:opacity-100 transition-opacity"
        title="Copy"
      >
        {copied ? <Check size={14} className="text-green-400" /> : <Copy size={14} className="text-zinc-400" />}
      </button>
    </div>
  );
}
