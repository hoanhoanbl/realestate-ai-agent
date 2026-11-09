"use client";

import { useState } from "react";
import Panorama360 from "@/components/Panorama360";
import PropertyGallery, { galleryPhotos } from "@/components/PropertyGallery";
import type { Property } from "@/lib/api";

type Tab = "photo" | "360";

// Khung ảnh ở trang chi tiết: tab Ảnh (bộ ảnh) và tab Xem 360° nếu căn có phòng 360°
export default function PropertyMedia({ property }: { property: Property }) {
  const [tab, setTab] = useState<Tab>("photo");
  const rooms = property.panoramas ?? [];
  const photoCount = galleryPhotos(property).length;

  if (rooms.length === 0) return <PropertyGallery property={property} />;

  const tabs: [Tab, string][] = [
    ["photo", photoCount > 0 ? `Ảnh (${photoCount})` : "Ảnh"],
    ["360", `Xem 360° (${rooms.length} phòng)`],
  ];

  return (
    <div>
      <div role="tablist" aria-label="Kiểu xem" className="mb-3 inline-flex rounded-lg bg-slate-100 p-1 text-sm">
        {tabs.map(([value, label]) => (
          <button
            key={value}
            role="tab"
            type="button"
            aria-selected={tab === value}
            onClick={() => setTab(value)}
            className={`min-h-11 rounded-md px-4 py-1.5 font-medium transition sm:min-h-0 ${
              tab === value ? "bg-white text-slate-900 shadow-card" : "text-slate-600 hover:text-slate-900"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {tab === "photo" ? (
        <PropertyGallery property={property} />
      ) : (
        <Panorama360 rooms={rooms} className="aspect-[16/10] rounded-2xl" />
      )}
    </div>
  );
}
