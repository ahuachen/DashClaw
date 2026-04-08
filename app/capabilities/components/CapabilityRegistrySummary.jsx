import { AlertTriangle, BadgeCheck, ShieldAlert, Wrench } from 'lucide-react';
import { Card, CardContent } from '../../components/ui/Card';

const SUMMARY_ITEMS = [
  {
    key: 'total',
    label: 'Total capabilities',
    icon: Wrench,
  },
  {
    key: 'attention',
    label: 'Attention needed',
    icon: AlertTriangle,
  },
  {
    key: 'stale',
    label: 'Stale certifications',
    icon: ShieldAlert,
  },
  {
    key: 'uncertified',
    label: 'Uncertified',
    icon: BadgeCheck,
  },
];

export default function CapabilityRegistrySummary({ counts }) {
  return (
    <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-4 mb-6">
      {SUMMARY_ITEMS.map((item) => {
        const Icon = item.icon;
        return (
          <Card key={item.key} hover={false}>
            <CardContent className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <div className="text-[10px] font-semibold uppercase tracking-widest text-zinc-500">
                    {item.label}
                  </div>
                  <div className="mt-2 text-2xl font-semibold text-white">
                    {counts?.[item.key] ?? 0}
                  </div>
                </div>
                <div className="rounded-lg border border-white/10 bg-white/5 p-2 text-zinc-400">
                  <Icon size={16} />
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}
