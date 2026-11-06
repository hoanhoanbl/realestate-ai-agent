import type { ReactNode } from "react";

// Class chung cho input, select, textarea. Điện thoại: chữ 16px để iPhone không tự phóng to khi chạm vào ô, cao 44px
export const INPUT =
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 outline-none transition placeholder:text-slate-500 sm:min-h-10 sm:text-sm focus:border-brand-500 focus:ring-2 focus:ring-brand-100 disabled:bg-slate-50";

interface FieldProps {
  id: string;
  label: string;
  hint?: string;
  className?: string;
  children: ReactNode;
}

// Nhãn + ô nhập + gợi ý nhỏ bên dưới
export default function Field({ id, label, hint, className = "", children }: FieldProps) {
  return (
    <div className={className}>
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      {children}
      {hint && <p className="mt-1 text-xs text-slate-500">{hint}</p>}
    </div>
  );
}
