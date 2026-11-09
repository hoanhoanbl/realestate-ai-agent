import type { Metadata, Viewport } from "next";
// Font tự lưu trong node_modules (không tải Google Fonts lúc build, Docker không cần mạng). Có đủ dấu tiếng Việt
import "@fontsource/be-vietnam-pro/400.css";
import "@fontsource/be-vietnam-pro/500.css";
import "@fontsource/be-vietnam-pro/600.css";
import "@fontsource/be-vietnam-pro/700.css";
import "./globals.css";

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#1d4ed8",
};

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
