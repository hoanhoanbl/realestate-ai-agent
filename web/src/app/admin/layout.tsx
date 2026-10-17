import type { Metadata } from "next";
import { Suspense } from "react";
import AdminShell from "@/components/AdminShell";

export const metadata: Metadata = {
  title: "RealEstate AI - Quản trị",
};

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  // usePathname trong AdminShell cần Suspense vì có trang động như /admin/leads/[id]
  return (
    <Suspense fallback={<p className="p-8 text-slate-500">Đang tải...</p>}>
      <AdminShell>{children}</AdminShell>
    </Suspense>
  );
}
