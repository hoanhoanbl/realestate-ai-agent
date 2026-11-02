"use client";

import Link from "next/link";
import { Button, Icon } from "@/components/ui";

// Thanh trên cùng của trang in: tự ẩn khi in. "Lưu PDF" = chọn máy in "Lưu dưới dạng PDF" trong hộp thoại của trình duyệt
export default function PrintToolbar({ backHref, backLabel, title }: { backHref?: string; backLabel?: string; title: string }) {
  return (
    <div className="sticky top-0 z-10 border-b border-slate-200 bg-white/95 backdrop-blur print:hidden">
      <div className="mx-auto flex max-w-[210mm] flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          {backHref && (
            <Link href={backHref} className="text-sm text-brand-600 hover:underline">
              ← {backLabel ?? "Quay lại"}
            </Link>
          )}
          <p className="truncate font-semibold text-slate-900">{title}</p>
        </div>
        <div className="flex items-center gap-2">
          <p className="hidden text-xs text-slate-500 md:block">Chọn &quot;Lưu dưới dạng PDF&quot; để tải file</p>
          <Button onClick={() => window.print()}>
            <Icon name="printer" className="h-4 w-4" />
            In / Lưu PDF
          </Button>
        </div>
      </div>
    </div>
  );
}
