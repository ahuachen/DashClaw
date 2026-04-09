import Link from 'next/link';
import { AlertTriangle, ArrowRight, FlaskConical, ShieldAlert } from 'lucide-react';
import { Card, CardContent, CardHeader } from './ui/Card';
import { Badge } from './ui/Badge';

function sortUrgentCapabilities(capabilities) {
  const rank = (capability) => {
    if (capability.status === 'unhealthy' || capability.status === 'failing') return 0;
    if (capability.status === 'degraded') return 1;
    if (capability.stale_check) return 2;
    if ((capability.certification_status || 'uncertified') === 'uncertified') return 3;
    return 4;
  };

  return [...capabilities].sort((left, right) => rank(left) - rank(right));
}

export default function MissionControlCapabilityHealthCard({
  loading = false,
  error = null,
  capabilities = [],
}) {
  const unhealthyCount = capabilities.filter((capability) => ['unhealthy', 'failing'].includes(capability.status)).length;
  const staleCount = capabilities.filter((capability) => capability.stale_check || capability.certification_status === 'stale').length;
  const uncertifiedCount = capabilities.filter((capability) => (capability.certification_status || 'uncertified') === 'uncertified').length;
  const urgentCapabilities = sortUrgentCapabilities(
    capabilities.filter((capability) => (
      ['unhealthy', 'failing', 'degraded'].includes(capability.status)
      || capability.stale_check
      || (capability.certification_status || 'uncertified') === 'uncertified'
    )),
  ).slice(0, 3);

  return (
    <Card>
      <CardHeader
        title="Capability Health"
        action={(
          <Link href="/capabilities" className="inline-flex items-center gap-0.5 text-[10px] text-brand transition-colors hover:text-brand-hover">
            Open <ArrowRight size={10} />
          </Link>
        )}
      />
      <CardContent className="space-y-3">
        {loading ? (
          <div className="text-sm text-zinc-500">Loading capability posture…</div>
        ) : error ? (
          <div className="rounded-lg border border-amber-500/20 bg-amber-500/10 px-3 py-2 text-xs text-amber-200">
            {error}
          </div>
        ) : (
          <>
            <div className="flex items-center gap-3 text-xs">
              {unhealthyCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-red-500" />
                  <span className="font-medium text-red-400">{unhealthyCount} unhealthy</span>
                </span>
              )}
              {staleCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-amber-500" />
                  <span className="font-medium text-amber-400">{staleCount} stale</span>
                </span>
              )}
              {uncertifiedCount > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 rounded-full bg-zinc-500" />
                  <span className="text-zinc-400">{uncertifiedCount} uncertified</span>
                </span>
              )}
              {unhealthyCount === 0 && staleCount === 0 && uncertifiedCount === 0 && (
                <span className="text-zinc-500">All capabilities healthy</span>
              )}
            </div>

            {urgentCapabilities.length > 0 && (
              <div className="space-y-1">
                {urgentCapabilities.map((capability) => (
                  <Link
                    key={capability.capability_id}
                    href={`/capabilities/${capability.capability_id}`}
                    className="flex items-center gap-2 rounded-lg px-1 py-0.5 transition-colors hover:bg-white/5"
                  >
                    <span className={`h-1.5 w-1.5 flex-shrink-0 rounded-full ${['unhealthy', 'failing'].includes(capability.status) ? 'bg-red-500' : capability.status === 'degraded' ? 'bg-amber-500' : 'bg-zinc-500/40'}`} />
                    <span className="flex-1 truncate text-xs text-zinc-400">
                      {capability.capability_name || capability.name}
                    </span>
                    <Badge size="xs" variant={(capability.certification_status || 'uncertified') === 'uncertified' ? 'default' : capability.certification_status === 'stale' ? 'warning' : capability.certification_status === 'failed' ? 'error' : 'success'}>
                      {capability.certification_status || 'uncertified'}
                    </Badge>
                  </Link>
                ))}
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
