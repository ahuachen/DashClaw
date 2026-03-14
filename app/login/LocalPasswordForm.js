'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';

export default function LocalPasswordForm() {
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const router = useRouter();

  async function handleSubmit(e) {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const res = await fetch('/api/auth/local', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });

      if (res.ok) {
        router.push('/mission-control');
      } else {
        const data = await res.json();
        setError(data.error || 'Login failed.');
      }
    } catch (err) {
      setError('An error occurred. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mt-6">
      <div className="relative mb-6">
        <div className="absolute inset-0 flex items-center">
          <div className="w-full border-t border-[var(--color-border,rgba(255,255,255,0.1))]"></div>
        </div>
        <div className="relative flex justify-center text-xs uppercase">
          <span className="bg-[#0a0a0a] px-2 text-[var(--color-text-muted,#71717a)]">or</span>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <input
            type="password"
            placeholder="Admin Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={loading}
            className="w-full px-3 py-2 bg-[#1a1a1a] border border-[rgba(255,255,255,0.1)] rounded-lg text-white text-sm focus:outline-none focus:ring-1 focus:ring-brand"
            required
          />
        </div>
        
        {error && (
          <p className="text-xs text-red-500 mt-1">{error}</p>
        )}

        <button
          type="submit"
          disabled={loading}
          className="w-full px-4 py-2.5 bg-zinc-100 text-black hover:bg-zinc-200 rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
        >
          {loading ? 'Signing in...' : 'Sign in with Password'}
        </button>
      </form>
    </div>
  );
}
