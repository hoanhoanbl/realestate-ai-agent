"use client";

import { useState } from "react";
import type { Property } from "@/lib/api";
import { typeLabel } from "@/lib/property";

// Nền dự phòng theo loại nhà khi căn chưa có ảnh hoặc link ảnh hỏng
const FALLBACK: Record<string, string> = {
  APARTMENT: "from-sky-100 to-blue-200 text-blue-500",
  TOWNHOUSE: "from-amber-50 to-orange-200 text-orange-500",
  VILLA: "from-emerald-50 to-teal-200 text-teal-600",
  SHOPHOUSE: "from-rose-50 to-pink-200 text-rose-500",
  LAND: "from-lime-50 to-green-200 text-green-600",
};

function TypeIcon({ type }: { type: string }) {
  const common = { fill: "none", stroke: "currentColor", strokeWidth: 1.5, strokeLinecap: "round" as const, strokeLinejoin: "round" as const };
  if (type === "APARTMENT") {
    return (
      <svg viewBox="0 0 24 24" className="h-2/5 max-h-16 w-2/5 max-w-16" {...common}>
        <path d="M4 21V5a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v16M15 9h4a1 1 0 0 1 1 1v11M3 21h18" />
        <path d="M8 8h3M8 12h3M8 16h3M17.5 13h0M17.5 17h0" />
      </svg>
    );
  }
  if (type === "LAND") {
    return (
      <svg viewBox="0 0 24 24" className="h-2/5 max-h-16 w-2/5 max-w-16" {...common}>
        <path d="M3 19 9 9l4 6 3-4 5 8H3Z" />
        <path d="M16 5.5a1.5 1.5 0 1 0 0-.01" />
      </svg>
    );
  }
  if (type === "SHOPHOUSE") {
    return (
      <svg viewBox="0 0 24 24" className="h-2/5 max-h-16 w-2/5 max-w-16" {...common}>
        <path d="M4 10v10h16V10M3 6l1.5-3h15L21 6v1a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0V6Z" />
        <path d="M9 20v-5h6v5" />
      </svg>
    );
  }
  return (
    <svg viewBox="0 0 24 24" className="h-2/5 max-h-16 w-2/5 max-w-16" {...common}>
      <path d="M3 11 12 4l9 7M5 9.5V20h14V9.5" />
      <path d="M10 20v-5h4v5" />
    </svg>
  );
}

interface PropertyImageProps {
  property: Pick<Property, "name" | "type" | "imageUrl">;
  className?: string;
  // Ảnh trên cùng trang (căn đầu tiên, trang chi tiết) thì tải ngay, còn lại tải khi cuộn tới
  priority?: boolean;
  showType?: boolean;
}

export default function PropertyImage({ property, className = "", priority = false, showType = true }: PropertyImageProps) {
  // Nhớ link nào bị hỏng (không phải cờ true/false) để khi đổi sang link khác thì thử tải lại
  const [brokenUrl, setBrokenUrl] = useState<string | null>(null);
  const hasImage = Boolean(property.imageUrl) && property.imageUrl !== brokenUrl;

  return (
    <div className={`relative overflow-hidden bg-slate-100 ${className}`}>
      {hasImage ? (
        // Link ảnh do quản lý nhập, có thể ở bất kỳ tên miền nào nên không dùng next/image
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={property.imageUrl ?? undefined}
          alt={property.name}
          loading={priority ? "eager" : "lazy"}
          onError={() => setBrokenUrl(property.imageUrl)}
          className="h-full w-full object-cover transition duration-500 group-hover:scale-105"
        />
      ) : (
        <div
          role="img"
          aria-label={`${typeLabel(property.type)} - chưa có ảnh`}
          className={`flex h-full w-full items-center justify-center bg-gradient-to-br ${FALLBACK[property.type] ?? "from-slate-100 to-slate-200 text-slate-400"}`}
        >
          <TypeIcon type={property.type} />
        </div>
      )}
      {showType && (
        <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700 shadow-sm backdrop-blur">
          {typeLabel(property.type)}
        </span>
      )}
    </div>
  );
}
