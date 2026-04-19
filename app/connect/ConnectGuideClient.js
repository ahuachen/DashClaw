'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Check, Copy, CircleDot, Shield, Terminal, ExternalLink, Download } from 'lucide-react';

function CopyButton({ value }) {
  const [copied, setCopied] = useState(false);

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(true);
      setTimeout(() => setCopied(false), 1500);
    } catch {
      setCopied(false);
    }
  }

  return (
    <button
      onClick={handleCopy}
      className="inline-flex items-center gap-1.5 rounded-full border border-border bg-surface-tertiary px-3 py-1.5 text-xs text-text-secondary transition-colors hover:border-border-hover hover:text-text-primary"
    >
      {copied ? <Check size={12} className="text-success" /> : <Copy size={12} />}
      {copied ? 'Copied' : 'Copy'}
    </button>
  );
}

function CodeCard({ title, body, tone = 'default' }) {
  const toneClass = tone === 'accent' ? 'border-brand/30' : 'border-border';

  return (
    <div className={`rounded-2xl border bg-surface-secondary ${toneClass}`}>
      <div className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
        <p className="text-sm font-medium text-text-primary">{title}</p>
        <CopyButton value={body} />
      </div>
      <pre className="overflow-x-auto whitespace-pre-wrap px-4 py-4 text-xs text-text-secondary">{body}</pre>
    </div>
  );
}

function StepSection({ number, title, summary, children }) {
  return (
    <section className="rounded-3xl border border-border bg-surface-secondary p-5 sm:p-6">
      <div className="flex items-start gap-4">
        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-brand/15 text-sm font-semibold text-brand">
          {number}
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-semibold text-text-primary">{title}</h2>
          <p className="mt-2 text-sm text-text-secondary">{summary}</p>
          <div className="mt-5">{children}</div>
        </div>
      </div>
    </section>
  );
}

// Render "plain text with **bold** segments" as React nodes. Keeps content
// strings in connectGuide.js portable (no JSX in data) while letting us
// emphasize surface names like **Mission Control** inline in a list item.
function renderInlineStrong(text) {
  const parts = text.split(/\*\*([^*]+)\*\*/g);
  return parts.map((part, i) =>
    i % 2 === 1 ? (
      <strong key={i} className="font-semibold text-text-primary">{part}</strong>
    ) : (
      <span key={i}>{part}</span>
    )
  );
}

function InfoList({ items, icon: Icon = CircleDot }) {
  return (
    <div className="space-y-2">
      {items.map((item) => (
        <div key={item} className="flex items-start gap-2 text-sm text-text-secondary">
          <Icon size={14} className="mt-0.5 shrink-0 text-text-tertiary" />
          <span>{renderInlineStrong(item)}</span>
        </div>
      ))}
    </div>
  );
}

export default function ConnectGuideClient({ content }) {
  const [selectedLanguage, setSelectedLanguage] = useState('node');
  const language = content.languages[selectedLanguage];

  return (
    <div className="space-y-6">
      <section className="rounded-3xl border border-brand/25 bg-surface-secondary p-6 sm:p-8">
        <p className="text-xs uppercase tracking-[0.32em] text-brand">Golden path</p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-white sm:text-4xl">Connect your first agent</h1>
        <p className="mt-3 max-w-3xl text-sm text-text-secondary sm:text-base">{content.intro}</p>
        <p className="mt-3 max-w-3xl text-sm text-text-secondary">{content.agentRequirementsNote}</p>

        <div className="mt-6 flex flex-wrap gap-2">
          {Object.entries(content.languages).map(([key, item]) => {
            const active = key === selectedLanguage;
            return (
              <button
                key={key}
                onClick={() => setSelectedLanguage(key)}
                className={`rounded-full border px-4 py-2 text-sm transition-colors ${
                  active
                    ? 'border-brand/45 bg-brand/10 text-brand'
                    : 'border-border bg-surface-tertiary text-text-secondary hover:text-text-primary'
                }`}
              >
                {item.label}
              </button>
            );
          })}
        </div>
      </section>

      <StepSection
        number="1"
        title="Choose your SDK"
        summary={`Use the ${language.label} path below. This page keeps the first-action flow short and only switches the parts that differ by language.`}
      >
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="rounded-2xl border border-border bg-surface-tertiary p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-text-tertiary">Selected SDK</p>
            <p className="mt-2 text-lg font-semibold text-text-primary">{language.label}</p>
            <p className="mt-2 text-sm text-text-secondary">Install command:</p>
            <CodeCard title={`${language.label} install`} body={language.installCommand} />
            <div className="mt-4">
              <InfoList items={content.baseUrlGuidance} icon={Terminal} />
            </div>
          </div>
          <div className="rounded-2xl border border-border bg-surface-tertiary p-4">
            <p className="text-xs uppercase tracking-[0.24em] text-text-tertiary">What the agent needs</p>
            <InfoList
              items={[
                `Base URL: ${content.baseUrl}`,
                'Workspace API key',
                'No direct database access',
                'Never use https://dashclaw.io as the agent base URL',
              ]}
            />
          </div>
        </div>
      </StepSection>

      <StepSection
        number="2"
        title="Set environment variables"
        summary="Set the minimum connection values in the agent runtime. The agent only talks to the DashClaw HTTP API."
      >
        <CodeCard title={`${language.label} environment`} body={language.envBlock} tone="accent" />
        <div className="mt-4 rounded-2xl border border-warning/20 bg-amber-500/5 p-4">
          <p className="text-sm text-amber-100">{content.envNote}</p>
        </div>
      </StepSection>

      <StepSection
        number="3"
        title="Copy the minimal starter snippet"
        summary="This is the smallest real example that creates a live action in DashClaw."
      >
        <CodeCard title={`${language.label} starter`} body={language.starterSnippet} />
      </StepSection>

      <StepSection
        number="4"
        title="Optional: enable verified agents"
        summary="Basic mode works with an API key only. Verified mode adds signed actions and pairing, but it is not required for your first successful connection."
      >
        <CodeCard title={`${language.label} pairing`} body={language.optionalPairingSnippet} />
      </StepSection>

      <StepSection
        number="5"
        title="Validate the connection"
        summary={language.validatorSummary}
      >
        <div className="mb-5 rounded-2xl border border-border bg-surface-tertiary p-5">
          <p className="text-sm text-text-secondary">Download the platform intelligence bundle:</p>
          <a
            href="/downloads/dashclaw-platform-intelligence.zip"
            download
            className="mt-3 inline-flex items-center gap-2 rounded-full border border-brand/30 bg-brand/10 px-4 py-2 text-sm font-medium text-brand transition-colors hover:border-brand/60 hover:bg-brand/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand/50"
          >
            <Download size={14} aria-hidden="true" />
            dashclaw-platform-intelligence.zip
          </a>
          <p className="mt-4 text-sm text-text-secondary">Unzip it in your project directory:</p>
          <pre className="mt-2 overflow-x-auto rounded-lg border border-border bg-surface-primary px-3 py-2 font-mono text-xs text-text-secondary">unzip dashclaw-platform-intelligence.zip</pre>
        </div>
        <CodeCard title={`${language.label} validator`} body={language.validatorCommand} tone="accent" />
        <div className="mt-4 rounded-2xl border border-border bg-surface-tertiary p-4">
          <p className="text-sm text-text-secondary">{content.validatorNote}</p>
        </div>
        <div className="mt-4 rounded-2xl border border-border bg-surface-tertiary p-4">
          <p className="text-sm text-text-secondary">
            Successful validation can feed proof back into{' '}
            <Link href="/setup" className="text-brand hover:text-brand-hover">
              /setup
            </Link>{' '}
            so the verification surface shows that a live SDK integration worked.
          </p>
        </div>
      </StepSection>

      <StepSection
        number="6"
        title="What success looks like"
        summary="After the snippet and validator run cleanly, DashClaw should start showing live evidence of the connection."
      >
        <InfoList items={content.successChecks} icon={Check} />
      </StepSection>

      <section className="rounded-3xl border border-border bg-surface-secondary p-6">
        <p className="text-xs uppercase tracking-[0.32em] text-text-tertiary">Common mistakes</p>
        <div className="mt-4">
          <InfoList items={content.commonMistakes} icon={Terminal} />
        </div>
      </section>

      <section className="rounded-3xl border border-border bg-surface-secondary p-6">
        <p className="text-xs uppercase tracking-[0.32em] text-text-tertiary">Next steps</p>
        <div className="mt-4 flex flex-wrap gap-3">
          <Link href="/dashboard" className="inline-flex items-center gap-2 rounded-full border border-brand/40 bg-brand/10 px-4 py-2 text-sm text-brand hover:border-brand/60">
            Open dashboard <ExternalLink size={14} />
          </Link>
          <Link href="/setup" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            Go to /setup
          </Link>
          <Link href="/docs" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            Read full SDK docs
          </Link>
          <Link href="/settings?tab=identity" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            Enable verified agents <Shield size={14} />
          </Link>
          <Link href="/policies" className="inline-flex items-center gap-2 rounded-full border border-border px-4 py-2 text-sm text-text-secondary hover:text-text-primary">
            Review policies
          </Link>
        </div>
      </section>
    </div>
  );
}
