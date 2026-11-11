import Link from "next/link";
import MauticTracking from "@/components/MauticTracking";
import { NEWSLETTER_FORM_URL } from "@/lib/newsletter";

import { Icon } from "@/components/ui";
import { TELEGRAM_BOT_URL } from "@/lib/site";

// Logo Telegram (hình máy bay giấy)
function TelegramIcon() {
  return (
    <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
      <path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z" />
    </svg>
  );
}

// Khu dành cho khách: không cần đăng nhập, không có đường dẫn sang khu quản trị
export default function KhachLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MauticTracking />
      <header className="sticky top-0 z-50 border-b border-slate-200/80 bg-white/90 backdrop-blur">
        <nav className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          <Link href="/" className="flex min-h-11 items-center gap-2 text-lg font-bold text-slate-900">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
              <Icon name="home" className="h-4 w-4" />
            </span>
            <span>
              RealEstate <span className="text-brand-600">AI</span>
            </span>
          </Link>
          <div className="flex items-center gap-1">
            <Link href="/" className="flex min-h-11 items-center rounded-lg px-3 text-sm font-medium text-slate-600 transition-colors hover:bg-slate-100 hover:text-slate-900">
              Danh sách nhà
            </Link>
            <a
              href={TELEGRAM_BOT_URL}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Hỏi trợ lý AI qua Telegram"
              className="flex min-h-11 min-w-11 items-center justify-center gap-2 rounded-lg px-2 text-sm font-medium text-sky-700 transition-colors hover:bg-sky-50 sm:px-3"
            >
              <TelegramIcon />
              <span className="hidden sm:inline">Hỏi AI qua Telegram</span>
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
            {NEWSLETTER_FORM_URL && (
              <Link href="/nhan-tin" className="mt-2 block text-blue-700 hover:underline">
                Đăng ký nhận bản tin
              </Link>
            )}
            <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="mt-1 inline-flex min-h-11 items-center gap-2 text-sky-700 hover:underline sm:min-h-0">
              <TelegramIcon />
              Trợ lý AI trên Telegram
            </a>
          </div>
        </div>
      </footer>
    </>
  );
}
