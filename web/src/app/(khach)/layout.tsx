import Link from "next/link";
import MauticTracking from "@/components/MauticTracking";

// Khu dành cho khách: không cần đăng nhập, không có đường dẫn sang khu quản trị
export default function KhachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MauticTracking />
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl items-center justify-between px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/" className="text-lg font-bold text-slate-900">
            RealEstate <span className="text-blue-600">AI</span>
          </Link>
          <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
            Danh sách nhà
          </Link>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
        RealEstate AI - đặt lịch xem nhà nhanh, xác nhận qua email
      </footer>
    </>
  );
}
