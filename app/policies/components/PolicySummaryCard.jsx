export default function PolicySummaryCard({ summary }) {
  return (
    <div className="rounded-lg border border-[rgba(255,255,255,0.06)] bg-[rgba(255,255,255,0.03)] p-3">
      <div className="text-[10px] uppercase tracking-wider text-tertiary mb-1">Policy summary</div>
      <p className="text-sm text-secondary">{summary}</p>
    </div>
  );
}
