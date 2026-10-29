"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, Suspense } from "react";
import { MAUTIC_PUBLIC_URL } from "@/lib/mautic";

declare global {
  interface Window {
    MauticTrackingObject?: string;
    mt?: (...args: unknown[]) => void;
  }
}

function MauticTrackingInner() {
  const pathname = usePathname();

  // Khi chuyển trang trong SPA Next.js, gửi sự kiện pageview mới cho Mautic
  // Không theo dõi các đường dẫn chứa token nhạy cảm (ký HĐ, cảm nhận) hoặc trang admin
  useEffect(() => {
    if (
      !MAUTIC_PUBLIC_URL ||
      !pathname ||
      pathname.startsWith("/ky") ||
      pathname.startsWith("/cam-nhan") ||
      pathname.startsWith("/admin")
    ) {
      return;
    }

    if (typeof window !== "undefined") {
      // Đảm bảo hàng đợi mt luôn khả dụng kể cả khi useEffect chạy trước khi mtc.js tải xong
      window.MauticTrackingObject = "mt";
      window.mt =
        window.mt ||
        function (...args: unknown[]) {
          ((window.mt as unknown as { q: unknown[] }).q =
            (window.mt as unknown as { q: unknown[] }).q || []).push(args);
        };
      window.mt("send", "pageview");
    }
  }, [pathname]);

  return null;
}

export default function MauticTracking() {
  // Biến trống (chưa cấu hình NEXT_PUBLIC_MAUTIC_URL) thì không tải script
  if (!MAUTIC_PUBLIC_URL) {
    return null;
  }

  return (
    <>
      <Script
        id="mautic-tracking"
        strategy="afterInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            (function(w,d,t,u,n,a,m){w['MauticTrackingObject']=n;
                w[n]=w[n]||function(){(w[n].q=w[n].q||[]).push(arguments)},a=d.createElement(t),
                m=d.getElementsByTagName(t)[0];a.async=1;a.src=u;m.parentNode.insertBefore(a,m)
            })(window,document,'script','${MAUTIC_PUBLIC_URL}/mtc.js','mt');
          `,
        }}
      />
      <Suspense fallback={null}>
        <MauticTrackingInner />
      </Suspense>
    </>
  );
}
