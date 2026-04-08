import Link from 'next/link';
import { AlertTriangle, FlaskConical, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';
import { Badge } from '../../components/ui/Badge';

const riskVariant = {
  low: 'success',
  medium: 'info',
  high: 'warning',
  critical: 'error',
};

const healthVariant = {
  healthy: 'success',
  degraded: 'warning',
  unhealthy: 'error',
  failing: 'error',
  unknown: 'default',
  untested: 'default',
};

const healthDot = {
  healthy: 'bg-emerald-500',
  degraded: 'bg-amber-500',
  unhealthy: 'bg-red-500',
  failing: 'bg-red-500',
  unknown: 'bg-zinc-500',
  untested: 'bg-zinc-500',
};

const certificationVariant = {
  certified: 'success',
  stale: 'warning',
  failed: 'error',
  uncertified: 'default',
};

function hasPricing(capability) {
  return capability.pricing && Object.keys(capability.pricing).length > 0;
}

function formatRelativeDate(value) {
  if (!value) return 'Never tested';
  return new Date(value).toLocaleString();
}

function readRecentError(capability) {
  const first = capability.recent_errors?.[0];
  if (!first) return null;
  return typeof first === 'string' ? first : first.message;
}

export default function CapabilityRegistryCard({
  capability,
  onRunTest,
  testStatus,
}) {
  const recentError = readRecentError(capability);

  return (
    <Card className="h-full" hover={false}>
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span
                className={`w-2 h-2 rounded-full ${healthDot[capability.status || capability.health_status] || healthDot.unknown}`}
                title={`health: ${capability.status || capability.health_status || 'unknown'}`}
              />
              <Link
                href={`/capabilities/${capability.capability_id}`}
                className="text-sm font-semibold text-white truncate hover:text-brand"
              >
                {capability.name}
              </Link>
            </div>
            <div className="text-xs text-zinc-500 font-mono truncate mt-0.5">{capability.slug}</div>
          </div>

          <Badge variant={riskVariant[capability.risk_level] || 'default'}>{capability.risk_level}</Badge>
        </div>

        {capability.description ? (
          <div className="text-xs text-zinc-400 line-clamp-2 mb-3">{capability.description}</div>
        ) : null}

        <div className="flex flex-wrap items-center gap-1.5 mb-3">
          <Badge variant={healthVariant[capability.status] || 'default'} size="xs">
            {capability.status || capability.health_status || 'unknown'}
          </Badge>
          <Badge variant={certificationVariant[capability.certification_status] || 'default'} size="xs">
            {capability.certification_status || 'uncertified'}
          </Badge>
          <Badge size="xs" variant={capability.stale_check ? 'warning' : 'success'}>
            {capability.stale_check ? 'Stale' : 'Fresh'}
          </Badge>
          {capability.category ? <Badge size="xs">{capability.category}</Badge> : null}
          {capability.requires_approval ? (
            <Badge size="xs" variant="warning">
              <ShieldAlert size={10} className="mr-1" /> approval
            </Badge>
          ) : null}
          {hasPricing(capability) ? (
            <Badge size="xs" variant="info">
              priced
            </Badge>
          ) : null}
          <Badge size="xs">{capability.source_type}</Badge>
        </div>

        <div className="space-y-1.5 mb-4 text-xs text-zinc-400">
          <div>
            <span className="text-zinc-500">Last tested:</span>{' '}
            <span>{formatRelativeDate(capability.last_tested_at)}</span>
          </div>
          <div>
            <span className="text-zinc-500">Recent failures:</span>{' '}
            <span>{capability.recent_failure_count ?? capability.failed_invocations ?? 0}</span>
          </div>
          {recentError ? (
            <div className="flex items-center gap-1 text-amber-300">
              <AlertTriangle size={12} />
              <span className="truncate">{recentError}</span>
            </div>
          ) : null}
        </div>

        {capability.tags?.length > 0 ? (
          <div className="flex flex-wrap gap-1 mb-4">
            {capability.tags.slice(0, 4).map((tag) => (
              <span
                key={tag}
                className="text-[10px] px-1.5 py-0.5 rounded bg-white/5 text-zinc-400 font-mono"
              >
                {tag}
              </span>
            ))}
          </div>
        ) : null}

        <div className="flex items-center justify-between gap-2">
          <Link
            href={`/capabilities/${capability.capability_id}`}
            className="text-xs text-brand hover:text-brand-hover"
          >
            Open detail
          </Link>
          <button
            onClick={() => onRunTest(capability)}
            disabled={testStatus?.submitting}
            aria-label={`Run Test ${capability.name}`}
            className="inline-flex items-center gap-2 rounded-lg border border-white/10 bg-white/5 px-3 py-1.5 text-xs text-white transition-colors hover:bg-white/10 disabled:opacity-50"
          >
            <FlaskConical size={12} />
            {testStatus?.submitting ? 'Running…' : 'Run Test'}
          </button>
        </div>

        {testStatus?.message ? (
          <div className={`mt-3 text-xs ${testStatus.error ? 'text-red-400' : 'text-emerald-400'}`}>
            {testStatus.message}
          </div>
        ) : null}
      </CardContent>
    </Card>
  );
}
