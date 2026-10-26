"use client";

import Script from "next/script";
import { usePathname } from "next/navigation";
import { useEffect, Suspense } from "react";

declare global {
  interface Window {
    MauticTrackingObject?: string;
    mt?: (...args: unknown[]) => void;
  }
}

function MauticTrackingInner() {
  const pathname = usePathname();

  // Khi chuyển trang trong SPA Next.js, gửi sự kiện pageview mới cho Mautic
  useEffect(() => {
    if (typeof window !== "undefined" && typeof window.mt === "function") {
      window.mt("send", "pageview");
    }
  }, [pathname]);

  return null;
}

export default function MauticTracking() {
  const mauticUrl =
    process.env.NEXT_PUBLIC_MAUTIC_URL || "https://mautic.136-85-40-9.sslip.io";

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
            })(window,document,'script','${mauticUrl}/mtc.js','mt');
            mt('send', 'pageview');
          `,
        }}
      />
      <Suspense fallback={null}>
        <MauticTrackingInner />
      </Suspense>
    </>
  );
}
