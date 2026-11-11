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

function isPrivatePath(pathname: string) {
  return ["/ky", "/cam-nhan", "/admin", "/lich", "/hop-dong"].some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );
}

function MauticTrackingInner() {
  const pathname = usePathname();
  const canTrack = Boolean(
    MAUTIC_PUBLIC_URL && pathname && !isPrivatePath(pathname),
  );

  // Khi chuyển trang trong SPA Next.js, gửi sự kiện pageview mới cho Mautic
  // Không gửi URL chứa token hoặc trang admin sang Mautic.
  useEffect(() => {
    if (!canTrack) return;

    if (typeof window !== "undefined") {
      // Đảm bảo hàng đợi mt luôn khả dụng kể cả khi useEffect chạy trước khi mtc.js tải xong
      window.MauticTrackingObject = "mt";
      window.mt =
        window.mt ||
        function (...args: unknown[]) {
          ((window.mt as unknown as { q: unknown[] }).q =
            (window.mt as unknown as { q: unknown[] }).q || []).push(args);
        };
      let referrer = document.referrer;
      try {
        if (referrer && isPrivatePath(new URL(referrer).pathname)) referrer = "";
      } catch {
        referrer = "";
      }
      // Chốt URL tại lúc gọi để hàng đợi tải chậm không đọc URL token sau khi chuyển trang.
      window.mt("send", "pageview", { page_url: window.location.href, referrer });
    }
  }, [pathname, canTrack]);

  if (!canTrack) return null;
  return (
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
  );
}

export default function MauticTracking() {
  return (
    <Suspense fallback={null}>
      <MauticTrackingInner />
    </Suspense>
  );
}
