import Link from "next/link";
import MauticTracking from "@/components/MauticTracking";

import { TELEGRAM_BOT_URL } from "@/lib/site";

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
          <div className="flex items-center gap-1">
            <Link href="/" className="rounded-md px-3 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100">
              Danh sách nhà
            </Link>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="hidden rounded-md px-3 py-2 text-sm font-medium text-sky-700 hover:bg-sky-50 sm:inline-block"
            >
              Hỏi AI qua Telegram
            </a>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
      <footer className="border-t border-slate-200 bg-white">
        <div className="mx-auto grid max-w-7xl gap-6 px-4 py-8 text-sm text-slate-600 sm:grid-cols-3 sm:px-6 lg:px-8">
          <div>
            <p className="font-bold text-slate-900">
              RealEstate <span className="text-brand-600">AI</span>
            </p>
            <p className="mt-2">Đặt lịch xem nhà nhanh, AI hỗ trợ tư vấn, xác nhận qua email.</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Khu vực</p>
            <p className="mt-2">TP.HCM · Hà Nội · Đà Nẵng · Phú Quốc</p>
          </div>
          <div>
            <p className="font-semibold text-slate-900">Hỗ trợ</p>
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="mt-2 block text-sky-700 hover:underline">
              Trợ lý AI trên Telegram
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
