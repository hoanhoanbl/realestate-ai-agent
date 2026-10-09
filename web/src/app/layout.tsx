import type { Metadata } from "next";
import NavBar from "@/components/NavBar";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealEstate AI - Đặt lịch xem nhà và quản lý khách",
  description: "Đăng ký xem nhà, AI chấm điểm khách hàng tiềm năng tự động",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        <NavBar />
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">
          {children}
        </main>
        <footer className="border-t border-slate-200 bg-white py-4 text-center text-xs text-slate-500">
          Chuyên đề Real Estate AI Agent - NestJS, n8n, Next.js, PostgreSQL
        </footer>
      </body>
    </html>
  );
}
