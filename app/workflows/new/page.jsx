'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Save } from 'lucide-react';
import PageLayout from '../../components/PageLayout';
import { Card, CardContent } from '../../components/ui/Card';
import WorkflowStepBuilder from '../components/WorkflowStepBuilder.jsx';
import { sanitizeExecutableSteps } from '../lib/workflowStepFormModel.js';

export default function NewWorkflowTemplatePage() {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [form, setForm] = useState({
    name: '',
    slug: '',
    description: '',
    objective: '',
    status: 'draft',
  });
  const [steps, setSteps] = useState([]);

  const update = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (!form.name.trim()) {
      setError('Name is required');
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const res = await fetch('/api/workflows/templates', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name.trim(),
          slug: form.slug.trim() || undefined,
          description: form.description.trim() || undefined,
          objective: form.objective.trim() || undefined,
          status: form.status,
          steps: sanitizeExecutableSteps(steps),
        }),
      });

      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error || 'Failed to create template');
      }

      const { template } = await res.json();
      router.push(`/workflows/${template.template_id}`);
    } catch (err) {
      setError(err.message);
      setSaving(false);
    }
  };

  return (
    <PageLayout
      title="New Workflow Template"
      subtitle="Define a reusable, versioned operational pattern"
      breadcrumbs={['Studio', 'Workflows', 'New']}
      actions={(
        <Link
          href="/workflows"
          className="flex items-center gap-2 px-3 py-1.5 text-sm text-zinc-400 hover:text-white bg-surface-tertiary border border-[rgba(255,255,255,0.06)] rounded-lg transition-colors"
        >
          <ArrowLeft size={14} /> Back
        </Link>
      )}
    >
      <form onSubmit={handleSubmit} className="max-w-4xl space-y-4">
        <Card>
          <CardContent className="p-5 space-y-4">
            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Name <span className="text-red-400">*</span>
              </label>
              <input
                type="text"
                aria-label="Name"
                value={form.name}
                onChange={update('name')}
                required
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Release hotfix workflow"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Slug <span className="text-zinc-600">(auto-generated if blank)</span>
              </label>
              <input
                type="text"
                value={form.slug}
                onChange={update('slug')}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white font-mono focus:outline-none focus:border-brand"
                placeholder="release-hotfix"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Description
              </label>
              <textarea
                value={form.description}
                onChange={update('description')}
                rows={2}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Short summary shown on the template card"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Objective
              </label>
              <textarea
                value={form.objective}
                onChange={update('objective')}
                rows={3}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
                placeholder="Declared goal for runs launched from this template"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-zinc-400 uppercase tracking-wider mb-1.5">
                Status
              </label>
              <select
                value={form.status}
                onChange={update('status')}
                className="w-full px-3 py-2 bg-surface-tertiary border border-white/10 rounded-lg text-sm text-white focus:outline-none focus:border-brand"
              >
                <option value="draft">Draft</option>
                <option value="active">Active</option>
                <option value="archived">Archived</option>
              </select>
            </div>
          </CardContent>
        </Card>

        <Card>
          <div className="px-5 pt-5 pb-3">
            <span className="text-sm font-medium text-zinc-200 uppercase tracking-wider">Steps</span>
            <span className="text-xs text-zinc-500 ml-2">Build a real ordered sequence of executable workflow steps.</span>
          </div>
          <CardContent className="p-5 pt-0">
            <WorkflowStepBuilder steps={steps} onChange={setSteps} />
          </CardContent>
        </Card>

        {error && (
          <div className="px-4 py-3 rounded-lg bg-red-500/10 border border-red-500/20 text-sm text-red-400">
            {error}
          </div>
        )}

        <div className="flex items-center gap-3">
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 text-sm text-white bg-brand hover:bg-brand/90 rounded-lg transition-colors disabled:opacity-50"
          >
            <Save size={14} />
            {saving ? 'Creating...' : 'Create Template'}
          </button>
          <Link
            href="/workflows"
            className="px-4 py-2 text-sm text-zinc-400 hover:text-white transition-colors"
          >
            Cancel
          </Link>
        </div>
      </form>
    </PageLayout>
  );
}
