import Link from "next/link";
import PropertyImage from "@/components/PropertyImage";
import { CARD, Icon, Skeleton } from "@/components/ui";
import { formatVnd, type Property } from "@/lib/api";
import { bedroomsLabel, formatBillion, formatNumber } from "@/lib/property";

export default function PropertyCard({ property: p, priority = false }: { property: Property; priority?: boolean }) {
  // Danh sách công khai trả số lượng; trang admin truyền nguyên mảng
  const panoramaCount = p.panoramaCount ?? p.panoramas?.length ?? 0;
  const photoCount = (p.imageUrl ? 1 : 0) + (p.imageCount ?? p.images?.length ?? 0);
  const bedrooms = bedroomsLabel(p);
  return (
    <Link
      href={`/nha/${p.id}`}
      className={`group flex flex-col overflow-hidden transition hover:-translate-y-0.5 hover:shadow-card-hover ${CARD}`}
    >
      <div className="relative">
        <PropertyImage property={p} priority={priority} className="aspect-[3/2]" />
        {p.status === "RESERVED" && (
          <span className="absolute left-3 top-3 rounded-full bg-amber-500 px-2.5 py-1 text-xs font-semibold text-white shadow">
            Đã có người đặt cọc
          </span>
        )}
        {panoramaCount > 0 && (
          <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-black/55 px-2.5 py-1 text-xs font-semibold text-white backdrop-blur">
            <Icon name="rotate360" className="h-3.5 w-3.5" />
            360°
          </span>
        )}
        {photoCount > 1 && (
          <span className="absolute bottom-3 right-3 rounded-full bg-black/55 px-2 py-0.5 text-xs font-medium text-white">
            {photoCount} ảnh
          </span>
        )}
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{p.address}</p>
        {p.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="text-lg font-bold text-brand-700" title={formatVnd(p.price)}>
            {formatBillion(p.price)}
          </span>
          <span className="flex items-center gap-3 text-sm text-slate-500">
            {bedrooms && (
              <span className="flex items-center gap-1" title="Phòng ngủ">
                <Icon name="bed" className="h-4 w-4" />
                {bedrooms}
              </span>
            )}
            {p.bathrooms != null && (
              <span className="flex items-center gap-1" title="Phòng tắm, WC">
                <Icon name="bath" className="h-4 w-4" />
                {p.bathrooms}
              </span>
            )}
            <span className="flex items-center gap-1" title="Diện tích">
              <Icon name="area" className="h-4 w-4" />
              {formatNumber(p.area)} m²
            </span>
          </span>
        </div>
      </div>
    </Link>
  );
}

// Khung giữ chỗ cùng kích thước thẻ thật để trang không bị giật khi dữ liệu về
export function PropertyCardSkeleton() {
  return (
    <div className={`overflow-hidden ${CARD}`} aria-hidden>
      <Skeleton className="aspect-[3/2] rounded-none" />
      <div className="space-y-2 p-4">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-3 w-1/2" />
        <Skeleton className="h-3 w-full" />
        <div className="flex justify-between pt-2">
          <Skeleton className="h-5 w-16" />
          <Skeleton className="h-4 w-12" />
        </div>
      </div>
    </div>
  );
}
