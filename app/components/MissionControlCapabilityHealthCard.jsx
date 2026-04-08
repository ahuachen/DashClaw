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
            <div className="grid grid-cols-3 gap-2">
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <div className="text-lg font-semibold text-white">{unhealthyCount} unhealthy</div>
                <div className="text-[10px] uppercase tracking-widest text-red-400">status</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <div className="text-lg font-semibold text-white">{staleCount} stale</div>
                <div className="text-[10px] uppercase tracking-widest text-amber-400">certifications</div>
              </div>
              <div className="rounded-lg border border-white/5 bg-white/5 px-3 py-2">
                <div className="text-lg font-semibold text-white">{uncertifiedCount} uncertified</div>
                <div className="text-[10px] uppercase tracking-widest text-zinc-400">capabilities</div>
              </div>
            </div>

            {urgentCapabilities.length === 0 ? (
              <div className="text-sm text-zinc-500">No urgent capability issues.</div>
            ) : (
              <div className="space-y-2">
                {urgentCapabilities.map((capability) => (
                  <Link
                    key={capability.capability_id}
                    href={`/capabilities/${capability.capability_id}`}
                    className="flex items-center justify-between gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-white/5"
                  >
                    <div className="min-w-0">
                      <div className="truncate text-xs font-medium text-white">
                        {capability.capability_name || capability.name}
                      </div>
                      <div className="flex items-center gap-1 mt-1">
                        <Badge size="xs" variant={['unhealthy', 'failing'].includes(capability.status) ? 'error' : capability.status === 'degraded' ? 'warning' : 'default'}>
                          {capability.status || 'unknown'}
                        </Badge>
                        <Badge size="xs" variant={(capability.certification_status || 'uncertified') === 'uncertified' ? 'default' : capability.certification_status === 'stale' ? 'warning' : capability.certification_status === 'failed' ? 'error' : 'success'}>
                          {capability.certification_status || 'uncertified'}
                        </Badge>
                      </div>
                    </div>
                    {capability.stale_check ? (
                      <ShieldAlert size={14} className="shrink-0 text-amber-400" />
                    ) : (
                      <AlertTriangle size={14} className="shrink-0 text-red-400" />
                    )}
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
