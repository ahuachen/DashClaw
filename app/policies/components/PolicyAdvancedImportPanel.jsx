'use client';

import { AlertTriangle, Upload, X } from 'lucide-react';
import { Badge } from '../../components/ui/Badge';
import { Card, CardContent } from '../../components/ui/Card';

const inputClass = 'w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white placeholder-zinc-600 focus:outline-none focus:border-brand';
const selectClass = 'w-full px-3 py-2 rounded-lg bg-[#111] border border-[rgba(255,255,255,0.1)] text-sm text-white focus:outline-none focus:border-brand';

export default function PolicyAdvancedImportPanel({
  open,
  onClose,
  importMode,
  setImportMode,
  importPack,
  setImportPack,
  importYaml,
  setImportYaml,
  importing,
  importResult,
  handleImport,
  packPreviews,
}) {
  if (!open) return null;

  const preview = packPreviews?.[importPack];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <Card className="w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-2xl border border-[rgba(255,255,255,0.08)]">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[rgba(255,255,255,0.06)]">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 rounded-full bg-amber-500/10 border border-amber-500/20 flex items-center justify-center">
              <Upload size={16} className="text-amber-300" />
            </div>
            <div>
              <h2 className="text-sm font-semibold text-white">Advanced import</h2>
              <p className="text-xs text-zinc-500">Expert tools for importing validated policy packs or raw YAML definitions.</p>
            </div>
          </div>
          <button onClick={onClose} className="text-zinc-500 hover:text-white transition-colors" aria-label="Close advanced import">
            <X size={16} />
          </button>
        </div>

        <CardContent>
          <div className="space-y-5">
            <div className="rounded-xl bg-amber-500/10 border border-amber-500/20 p-4 flex items-start gap-3">
              <AlertTriangle size={16} className="text-amber-300 mt-0.5 flex-shrink-0" />
              <div className="space-y-1">
                <p className="text-sm font-medium text-amber-100">Advanced import is intended for expert users.</p>
                <p className="text-xs text-amber-200/80">
                  Use this when you already have a validated YAML policy definition or you know exactly which policy pack you want to install.
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setImportMode('pack')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  importMode === 'pack'
                    ? 'bg-brand text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Policy pack
              </button>
              <button
                type="button"
                onClick={() => setImportMode('yaml')}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors ${
                  importMode === 'yaml'
                    ? 'bg-brand text-white'
                    : 'bg-zinc-700 text-zinc-300 hover:bg-zinc-600'
                }`}
              >
                Raw YAML
              </button>
            </div>

            {importMode === 'pack' ? (
              <div className="space-y-3">
                <div>
                  <label className="block text-xs text-zinc-400 mb-1">Policy pack</label>
                  <select
                    value={importPack}
                    onChange={(e) => setImportPack(e.target.value)}
                    className={selectClass}
                  >
                    <option value="enterprise-strict">Enterprise Strict</option>
                    <option value="smb-safe">SMB Safe</option>
                    <option value="startup-growth">Startup Growth</option>
                    <option value="development">Development</option>
                  </select>
                </div>

                {preview && (
                  <div className="rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] p-3">
                    <span className="text-xs font-medium text-white">{preview.name}</span>
                    <p className="text-[10px] text-zinc-500 mt-1">{preview.description}</p>
                    {preview.recommended_for && (
                      <p className="text-[10px] text-zinc-600 mt-1">Recommended for: {preview.recommended_for}</p>
                    )}
                  </div>
                )}
              </div>
            ) : (
              <div>
                <label className="block text-xs text-zinc-400 mb-1">YAML policy definition</label>
                <textarea
                  value={importYaml}
                  onChange={(e) => setImportYaml(e.target.value)}
                  placeholder="Paste your policy YAML here..."
                  rows={8}
                  className={`${inputClass} font-mono`}
                />
              </div>
            )}

            <div className="flex items-center gap-3">
              <button
                onClick={handleImport}
                disabled={importing || (importMode === 'yaml' && !importYaml.trim())}
                className="px-4 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:bg-brand-hover transition-colors disabled:opacity-50"
              >
                {importing ? 'Importing...' : 'Import'}
              </button>
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 rounded-lg bg-zinc-700 text-zinc-300 text-sm font-medium hover:bg-zinc-600 transition-colors"
              >
                Close
              </button>
            </div>

            {importResult && (
              <div className="p-3 rounded-lg bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.06)] text-sm space-y-1">
                <div className="flex items-center gap-2">
                  <Badge variant="success">{importResult.imported ?? 0} imported</Badge>
                  {(importResult.skipped ?? 0) > 0 && (
                    <Badge variant="warning">{importResult.skipped} skipped</Badge>
                  )}
                  {(importResult.errors ?? 0) > 0 && (
                    <Badge variant="error">{importResult.errors} errors</Badge>
                  )}
                  {(importResult.skipped ?? 0) === 0 && (
                    <Badge variant="warning">0 skipped</Badge>
                  )}
                  {(importResult.errors ?? 0) === 0 && (
                    <Badge variant="error">0 errors</Badge>
                  )}
                </div>
                {importResult.details && (
                  <p className="text-xs text-zinc-400 mt-1">{importResult.details}</p>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
