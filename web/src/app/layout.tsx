import type { Metadata } from 'next';
import Link from 'next/link';
import './globals.css';

export const metadata: Metadata = {
  title: 'Real Estate AI Agent - Đặt lịch xem nhà & Quản lý Lead',
  description: 'Hệ thống tự động hóa thẩm định khách hàng bất động sản bằng AI',
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="vi" className="h-full">
      <body className="min-h-full flex flex-col bg-slate-50 text-slate-800 antialiased font-sans">
        {/* Navigation Bar */}
        <header className="bg-white border-b border-slate-200 sticky top-0 z-50 shadow-sm">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
            <Link href="/" className="flex items-center space-x-3 group">
              <span className="text-2xl group-hover:scale-110 transition-transform">🏢</span>
              <div>
                <span className="font-bold text-lg text-slate-900 tracking-tight">RealEstate <span className="text-blue-600">AI</span></span>
                <span className="hidden sm:inline-block ml-2 text-xs font-semibold px-2 py-0.5 bg-blue-50 text-blue-700 rounded-full border border-blue-200">Auto Agent</span>
              </div>
            </Link>

            <nav className="flex items-center space-x-2 sm:space-x-4">
              <Link
                href="/"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition"
              >
                🏠 Đặt lịch xem nhà
              </Link>
              <Link
                href="/leads"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition"
              >
                👥 Quản lý Leads
              </Link>
              <Link
                href="/stats"
                className="px-3 py-2 rounded-lg text-sm font-semibold text-slate-700 hover:text-blue-600 hover:bg-blue-50 transition"
              >
                📊 Dashboard Thống kê
              </Link>
            </nav>
          </div>
        </header>

        {/* Main Content */}
        <main className="flex-1 max-w-7xl w-full mx-auto px-4 sm:px-6 lg:px-8 py-8">
          {children}
        </main>

        {/* Footer */}
        <footer className="bg-white border-t border-slate-200 py-4 text-center text-xs text-slate-500">
          Chuyên đề Real Estate AI Agent © 2026 • NestJS + n8n + Next.js + PostgreSQL
        </footer>
      </body>
    </html>
  );
}
