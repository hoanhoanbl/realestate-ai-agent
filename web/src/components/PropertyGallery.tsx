"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import PropertyImage from "@/components/PropertyImage";
import { Icon } from "@/components/ui";
import type { Property } from "@/lib/api";

// Ảnh đại diện + ảnh thêm, bỏ link trùng
export function galleryPhotos(p: Pick<Property, "imageUrl" | "images">): string[] {
  return [...new Set([p.imageUrl, ...(p.images ?? [])].filter((u): u is string => Boolean(u)))];
}

// Ảnh nhỏ: link Unsplash thì xin bản 240px cho nhẹ; link khác giữ nguyên
function thumbUrl(url: string): string {
  try {
    const u = new URL(url);
    if (u.hostname !== "images.unsplash.com") return url;
    u.searchParams.set("w", "240");
    u.searchParams.set("h", "160");
    return u.toString();
  } catch {
    return url;
  }
}

const NAV_BTN =
  "absolute top-1/2 flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full bg-white/85 text-slate-800 shadow transition hover:bg-white";

// Vuốt ngang trên điện thoại để chuyển ảnh
function useSwipe(onPrev: () => void, onNext: () => void) {
  const startX = useRef<number | null>(null);
  return {
    onTouchStart: (e: React.TouchEvent) => {
      startX.current = e.touches[0].clientX;
    },
    onTouchEnd: (e: React.TouchEvent) => {
      if (startX.current === null) return;
      const dx = e.changedTouches[0].clientX - startX.current;
      startX.current = null;
      if (Math.abs(dx) < 40) return;
      if (dx > 0) onPrev();
      else onNext();
    },
  };
}

export default function PropertyGallery({ property, className = "" }: { property: Property; className?: string }) {
  const photos = galleryPhotos(property);
  const [index, setIndex] = useState(0);
  const [zoom, setZoom] = useState(false);
  const count = photos.length;

  const prev = useCallback(() => setIndex((i) => (i - 1 + count) % count), [count]);
  const next = useCallback(() => setIndex((i) => (i + 1) % count), [count]);
  const swipe = useSwipe(prev, next);

  // Phím mũi tên và Esc khi đang xem toàn màn hình; khoá cuộn trang phía sau
  useEffect(() => {
    if (!zoom) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") setZoom(false);
      else if (e.key === "ArrowLeft") prev();
      else if (e.key === "ArrowRight") next();
    };
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
    };
  }, [zoom, prev, next]);

  // Chưa có ảnh nào: hình minh hoạ theo loại nhà như cũ
  if (count === 0) return <PropertyImage property={property} priority className={`aspect-[16/10] rounded-2xl ${className}`} />;

  const current = photos[Math.min(index, count - 1)];

  return (
    <div className={className}>
      <div className="relative overflow-hidden rounded-2xl bg-slate-100" {...swipe}>
        <button type="button" onClick={() => setZoom(true)} className="block w-full" aria-label="Xem ảnh toàn màn hình">
          {/* eslint-disable-next-line @next/next/no-img-element -- link ảnh do quản lý nhập, ở bất kỳ tên miền nào */}
          <img src={current} alt={`${property.name}, ảnh ${index + 1}`} className="aspect-[16/10] w-full object-cover" />
        </button>
        {count > 1 && (
          <>
            <button type="button" onClick={prev} className={`${NAV_BTN} left-3`} aria-label="Ảnh trước">
              <Icon name="chevronLeft" />
            </button>
            <button type="button" onClick={next} className={`${NAV_BTN} right-3`} aria-label="Ảnh sau">
              <Icon name="chevronRight" />
            </button>
          </>
        )}
        <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2.5 py-1 text-xs font-medium text-white">
          {index + 1}/{count}
        </span>
      </div>

      {count > 1 && (
        <div className="mt-2 flex gap-2 overflow-x-auto pb-1">
          {photos.map((url, i) => (
            <button
              key={url}
              type="button"
              onClick={() => setIndex(i)}
              aria-label={`Ảnh ${i + 1}`}
              aria-current={i === index}
              className={`h-16 w-24 shrink-0 overflow-hidden rounded-lg ring-2 transition ${
                i === index ? "ring-brand-500" : "ring-transparent opacity-70 hover:opacity-100"
              }`}
            >
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={thumbUrl(url)} alt="" loading="lazy" className="h-full w-full object-cover" />
            </button>
          ))}
        </div>
      )}

      {zoom && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={`Ảnh ${property.name}`}
          className="fixed inset-0 z-50 flex flex-col bg-black/95"
          onClick={() => setZoom(false)}
        >
          <div className="flex items-center justify-between px-4 py-3 text-sm text-white">
            <span>
              {index + 1}/{count}
            </span>
            <button type="button" onClick={() => setZoom(false)} aria-label="Đóng" className="rounded-full p-2 hover:bg-white/10">
              <Icon name="close" />
            </button>
          </div>
          <div className="relative flex flex-1 items-center justify-center px-2 pb-6" {...swipe}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={current}
              alt={`${property.name}, ảnh ${index + 1}`}
              className="max-h-full max-w-full object-contain"
              onClick={(e) => e.stopPropagation()}
            />
            {count > 1 && (
              <>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    prev();
                  }}
                  className={`${NAV_BTN} left-4`}
                  aria-label="Ảnh trước"
                >
                  <Icon name="chevronLeft" />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    next();
                  }}
                  className={`${NAV_BTN} right-4`}
                  aria-label="Ảnh sau"
                >
                  <Icon name="chevronRight" />
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
