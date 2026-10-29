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
      !pathname ||
      pathname.startsWith("/ky") ||
      pathname.startsWith("/cam-nhan") ||
      pathname.startsWith("/admin")
    ) {
      return;
    }

    if (typeof window !== "undefined" && typeof window.mt === "function") {
      window.mt("send", "pageview");
    }
  }, [pathname]);

  return null;
}

export default function MauticTracking() {
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
