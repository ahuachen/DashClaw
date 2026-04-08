import { Paperclip, Download, Image as ImageIcon, FileText } from 'lucide-react';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes}B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)}KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)}MB`;
}

function isImageType(mimeType) {
  return mimeType?.startsWith('image/');
}

export default function AttachmentChips({ attachments, compact }) {
  if (!attachments || attachments.length === 0) return null;

  const attachmentUrl = (att) => `/api/messages/attachments?id=${att.id}`;

  return (
    <div className={`flex flex-wrap gap-2 ${compact ? 'mt-1.5' : 'mt-2'}`}>
      {attachments.map(att => (
        <a
          key={att.id}
          href={attachmentUrl(att)}
          target="_blank"
          rel="noopener noreferrer"
          className="group flex items-center gap-1.5 px-2 py-1 rounded-md bg-[rgba(255,255,255,0.04)] border border-[rgba(255,255,255,0.06)] hover:bg-[rgba(255,255,255,0.08)] transition-colors text-xs text-zinc-300"
        >
          {isImageType(att.mime_type) ? (
            <ImageIcon size={compact ? 10 : 12} className="text-blue-400 flex-shrink-0" />
          ) : (
            <FileText size={compact ? 10 : 12} className="text-zinc-400 flex-shrink-0" />
          )}
          <span className="truncate max-w-[120px]">{att.filename}</span>
          <span className="text-zinc-500">{formatSize(att.size_bytes)}</span>
          <Download size={10} className="opacity-0 group-hover:opacity-100 transition-opacity text-zinc-400" />
        </a>
      ))}
    </div>
  );
}
