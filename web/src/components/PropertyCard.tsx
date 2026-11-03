import Link from "next/link";
import PropertyImage from "@/components/PropertyImage";
import { CARD, Skeleton } from "@/components/ui";
import { formatVnd, type Property } from "@/lib/api";
import { formatBillion } from "@/lib/property";

export default function PropertyCard({ property: p, priority = false }: { property: Property; priority?: boolean }) {
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
      </div>
      <div className="flex flex-1 flex-col p-4">
        <h2 className="font-semibold text-slate-900 group-hover:text-brand-700">{p.name}</h2>
        <p className="mt-1 line-clamp-1 text-sm text-slate-500">{p.address}</p>
        {p.description && <p className="mt-2 line-clamp-2 text-sm text-slate-600">{p.description}</p>}
        <div className="mt-auto flex items-end justify-between pt-3">
          <span className="text-lg font-bold text-brand-700" title={formatVnd(p.price)}>
            {formatBillion(p.price)}
          </span>
          <span className="text-sm text-slate-500">{Number(p.area)} m²</span>
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
