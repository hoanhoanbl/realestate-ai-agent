import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "RealEstate AI - Đặt lịch xem nhà và quản lý khách",
  description: "Đăng ký xem nhà, AI chấm điểm khách hàng tiềm năng tự động",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="vi" className="h-full antialiased">
      <body className="flex min-h-full flex-col font-sans">
        {/* Thanh điều hướng nằm trong layout của từng khu: (khach) và admin */}
        {children}
      </body>
    </html>
  );
}
