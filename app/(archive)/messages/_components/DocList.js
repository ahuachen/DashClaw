import { FileText, ChevronRight } from 'lucide-react';
import { Card, CardContent } from '../../../components/ui/Card';
import { EmptyState } from '../../../components/ui/EmptyState';
import { timeAgo } from './helpers';

export default function DocList({ docs, onSelect, selectedId }) {
  if (docs.length === 0) {
    return (
      <Card hover={false}>
        <CardContent className="py-6">
          <EmptyState
            icon={FileText}
            title="No shared documents"
            description="Agents can create shared workspace documents via the SDK."
          />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card hover={false}>
      <CardContent className="pt-0 divide-y divide-[rgba(255,255,255,0.04)]">
        {docs.map(doc => (
          <div
            key={doc.id}
            onClick={() => onSelect(doc)}
            className={`flex items-start gap-3 py-3 px-1 cursor-pointer transition-colors rounded-sm ${
              doc.id === selectedId ? 'bg-[rgba(255,255,255,0.04)]' : 'hover:bg-[rgba(255,255,255,0.02)]'
            }`}
          >
            <div className="w-8 h-8 rounded-md flex items-center justify-center flex-shrink-0 mt-0.5 bg-[rgba(255,255,255,0.06)]">
              <FileText size={14} className="text-zinc-400" />
            </div>
            <div className="flex-1 min-w-0">
              <span className="text-sm font-medium text-zinc-200 truncate block">{doc.name || doc.title || 'Untitled document'}</span>
              <div className="text-xs text-zinc-500 mt-0.5">
                v{doc.version} · by {doc.last_edited_by || doc.created_by}
              </div>
            </div>
            <div className="flex flex-col items-end gap-1 flex-shrink-0">
              <span className="text-xs text-zinc-600">{timeAgo(doc.updated_at)}</span>
              <ChevronRight size={12} className="text-zinc-700" />
            </div>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
