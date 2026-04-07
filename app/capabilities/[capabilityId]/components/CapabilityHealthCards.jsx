import { Card, CardContent, CardHeader } from '../../../components/ui/Card';

function formatPercent(value) {
  if (typeof value !== 'number') return '0%';
  return `${Math.round(value)}%`;
}

function formatLatency(value) {
  if (typeof value !== 'number') return 'n/a';
  return `${value} ms`;
}

const DEFAULT_METRICS = [
  { label: '1d success rate', key: 'success_rate_1d', format: formatPercent },
  { label: '7d success rate', key: 'success_rate_7d', format: formatPercent },
  { label: 'p95 latency', key: 'p95_latency_ms', format: formatLatency },
  { label: 'Stale check', key: 'stale_check', format: (value) => (value ? 'Stale' : 'Fresh') },
];

export default function CapabilityHealthCards({ health }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-4 gap-4">
      {DEFAULT_METRICS.map((metric) => (
        <Card key={metric.key} hover={false}>
          <CardHeader title={metric.label} />
          <CardContent>
            <div className="text-2xl font-semibold text-white">
              {metric.format(health?.[metric.key])}
            </div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
