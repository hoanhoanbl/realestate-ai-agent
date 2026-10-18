import { Suspense } from "react";
import NavBar from "@/components/NavBar";

// Khung tạm cho các trang nội bộ cũ (/leads, /stats) cho tới khi có khung admin có đăng nhập
export default function NoiBoShell({ children }: { children: React.ReactNode }) {
  return (
    <>
      {/* usePathname trong NavBar cần Suspense vì trang /leads/[id] có tham số động */}
      <Suspense fallback={<div className="h-[57px] border-b border-slate-200 bg-white" />}>
        <NavBar />
      </Suspense>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        Chuyên đề Real Estate AI Agent - NestJS, n8n, Next.js, PostgreSQL
      </footer>
    </>
  );
}
