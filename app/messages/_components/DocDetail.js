import { useState } from 'react';
import { Download, Copy, ChevronDown, FileText, FileSpreadsheet } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { timeAgo, copyToClipboard } from './helpers';
import MarkdownBody from './MarkdownBody';

const EXPORT_FORMATS = [
  { id: 'md', label: 'Markdown (.md)', icon: FileText },
  { id: 'pdf', label: 'PDF (.pdf)', icon: Download },
  { id: 'docx', label: 'Word (.docx)', icon: FileText },
  { id: 'xlsx', label: 'Excel (.xlsx)', icon: FileSpreadsheet },
];

export default function DocDetail({ doc }) {
  const [copied, setCopied] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [exporting, setExporting] = useState(false);
  const docName = doc.name || doc.title || 'Untitled document';
  const docContent = doc.content || '';
  const safeFilename = docName.replace(/[^a-zA-Z0-9_-]/g, '_');

  async function handleExport(format) {
    setShowExportMenu(false);
    if (format === 'md') {
      const blob = new Blob([docContent], { type: 'text/markdown' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${safeFilename}.md`;
      a.click();
      URL.revokeObjectURL(url);
      return;
    }

    setExporting(true);
    try {
      const { exportToPdf, exportToWord, exportToExcel } = await import('../../lib/docExport');
      if (format === 'pdf') await exportToPdf(docContent, safeFilename);
      else if (format === 'docx') await exportToWord(docContent, safeFilename);
      else if (format === 'xlsx') await exportToExcel(docContent, safeFilename);
    } catch (err) {
      console.error('Export failed:', err);
    } finally {
      setExporting(false);
    }
  }

  async function handleCopy() {
    const ok = await copyToClipboard(docContent);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  }

  return (
    <div>
      <h4 className="text-sm font-semibold text-white mb-1">{docName}</h4>
      <div className="flex items-center gap-2 mb-2">
        <Badge variant="info" size="xs">v{doc.version}</Badge>
        <span className="text-xs text-tertiary">by {doc.last_edited_by || doc.created_by}</span>
      </div>
      <div className="bg-[rgba(255,255,255,0.02)] rounded-md p-3 mb-2 max-h-[400px] overflow-y-auto">
        <MarkdownBody content={docContent} />
      </div>
      <div className="flex items-center gap-2 mb-2">
        <div className="relative">
          <button
            onClick={() => setShowExportMenu(!showExportMenu)}
            disabled={exporting}
            className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[rgba(255,255,255,0.04)] text-secondary hover:text-secondary hover:bg-[rgba(255,255,255,0.08)] transition-colors disabled:opacity-50"
          >
            <Download size={10} />
            {exporting ? 'Exporting...' : 'Download'}
            <ChevronDown size={10} />
          </button>
          {showExportMenu && (
            <div className="absolute left-0 top-full mt-1 w-44 bg-surface-secondary border border-[rgba(255,255,255,0.1)] rounded-lg shadow-xl z-50 py-1">
              {EXPORT_FORMATS.map((fmt) => (
                <button
                  key={fmt.id}
                  onClick={() => handleExport(fmt.id)}
                  className="w-full text-left px-3 py-1.5 text-xs text-secondary hover:bg-white/5 transition-colors flex items-center gap-2"
                >
                  <fmt.icon size={12} className="text-tertiary" />
                  {fmt.label}
                </button>
              ))}
            </div>
          )}
        </div>
        <button
          onClick={handleCopy}
          className="flex items-center gap-1 px-2 py-1 text-xs rounded-md bg-[rgba(255,255,255,0.04)] text-secondary hover:text-secondary hover:bg-[rgba(255,255,255,0.08)] transition-colors"
        >
          <Copy size={10} /> {copied ? 'Copied!' : 'Copy Content'}
        </button>
      </div>
      <div className="text-xs text-disabled">
        Created {doc.created_at ? new Date(doc.created_at).toLocaleString() : 'unknown'}
        {doc.updated_at && doc.updated_at !== doc.created_at && ` | Updated ${timeAgo(doc.updated_at)}`}
      </div>
    </div>
  );
}
