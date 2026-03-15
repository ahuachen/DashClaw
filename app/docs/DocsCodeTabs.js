'use client';

import { useState } from 'react';

export default function DocsCodeTabs({ 
  nodeSnippet, 
  pythonSnippet, 
  nodeTitle = 'Node.js', 
  pythonTitle = 'Python' 
}) {
  const [activeTab, setActiveTab] = useState('node');

  return (
    <div className="rounded-xl bg-[#0d0d0d] border border-[rgba(255,255,255,0.06)] overflow-hidden">
      <div className="flex border-b border-[rgba(255,255,255,0.06)] bg-[#090909]">
        <button
          onClick={() => setActiveTab('node')}
          className={`px-4 py-2 text-xs font-mono transition-colors ${
            activeTab === 'node' 
              ? 'text-brand border-b border-brand bg-[rgba(249,115,22,0.05)]' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {nodeTitle}
        </button>
        <button
          onClick={() => setActiveTab('python')}
          className={`px-4 py-2 text-xs font-mono transition-colors ${
            activeTab === 'python' 
              ? 'text-brand border-b border-brand bg-[rgba(249,115,22,0.05)]' 
              : 'text-zinc-500 hover:text-zinc-300'
          }`}
        >
          {pythonTitle}
        </button>
      </div>
      <div className="p-5 overflow-x-auto">
        <pre className="font-mono text-sm leading-relaxed text-zinc-300">
          {activeTab === 'node' ? nodeSnippet : pythonSnippet}
        </pre>
      </div>
    </div>
  );
}
