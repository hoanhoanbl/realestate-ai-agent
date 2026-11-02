// Biểu đồ thanh ngang so sánh hai kỳ (tuần này / tuần trước), vẽ bằng CSS, không cần thư viện
export interface CompareRow {
  label: string;
  current: number;
  previous: number;
}

export default function CompareBars({ rows, currentLabel = "Tuần này", previousLabel = "Tuần trước" }: {
  rows: CompareRow[];
  currentLabel?: string;
  previousLabel?: string;
}) {
  const max = Math.max(1, ...rows.flatMap((r) => [r.current, r.previous]));

  return (
    <div>
      <div className="flex items-center gap-4 text-xs text-slate-500">
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-brand-600" />
          {currentLabel}
        </span>
        <span className="flex items-center gap-1.5">
          <span className="h-2.5 w-2.5 rounded-sm bg-slate-300" />
          {previousLabel}
        </span>
      </div>
      <ul className="mt-4 space-y-4">
        {rows.map((r) => (
          <li key={r.label} className="grid grid-cols-[8.5rem_1fr] items-center gap-3 text-sm sm:grid-cols-[10rem_1fr]">
            <span className="text-slate-700">{r.label}</span>
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <div className="h-3 rounded-r bg-brand-600 transition-all" style={{ width: `${(r.current / max) * 100}%`, minWidth: r.current > 0 ? 4 : 0 }} />
                <span className="text-xs font-semibold text-slate-900">{r.current}</span>
              </div>
              <div className="flex items-center gap-2">
                <div className="h-3 rounded-r bg-slate-300 transition-all" style={{ width: `${(r.previous / max) * 100}%`, minWidth: r.previous > 0 ? 4 : 0 }} />
                <span className="text-xs text-slate-500">{r.previous}</span>
              </div>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}
