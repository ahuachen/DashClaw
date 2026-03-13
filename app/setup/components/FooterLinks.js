import Link from 'next/link';

export function FooterLinks({ isAuthenticated, authReady, verificationOverall }) {
  return (
    <div className="rounded-2xl border border-[rgba(255,255,255,0.08)] bg-[#111] p-5 text-sm text-zinc-500">
      <p className="text-xs uppercase tracking-[0.3em] text-zinc-500">Operator links</p>
      <div className="mt-4 flex flex-col gap-3">
        <Link href="/self-host" className="transition-colors hover:text-zinc-300">
          Deployment guide -&gt;
        </Link>
        <Link href="/docs" className="transition-colors hover:text-zinc-300">
          API docs -&gt;
        </Link>
        {!isAuthenticated && authReady ? (
          <Link href="/login" className="transition-colors hover:text-zinc-300">
            Sign in -&gt;
          </Link>
        ) : null}
        {isAuthenticated ? (
          <Link href="/api-keys" className="transition-colors hover:text-zinc-300">
            Manage API keys -&gt;
          </Link>
        ) : null}
        {isAuthenticated && verificationOverall !== 'blocked' ? (
          <Link href="/dashboard" className="font-medium text-brand transition-colors hover:text-brand">
            Go to dashboard -&gt;
          </Link>
        ) : null}
      </div>
    </div>
  );
}
