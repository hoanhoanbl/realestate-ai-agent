"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BookingForm from "@/components/BookingForm";
import PropertyImage from "@/components/PropertyImage";
import { Alert, CARD, Skeleton } from "@/components/ui";
import { ApiError, formatVnd, getProperty, type Property } from "@/lib/api";
import { cityOf, formatBillion } from "@/lib/property";

// useParams() cần nằm trong Suspense vì `id` chỉ biết lúc người dùng mở trang
export default function PropertyDetailPage() {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <PropertyDetail />
    </Suspense>
  );
}

function PropertyDetail() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const invalidId = !Number.isInteger(id) || id <= 0;

  const [property, setProperty] = useState<Property | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;
    getProperty(id)
      .then((data) => {
        if (!cancelled) setProperty(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setError(e instanceof Error ? e.message : "Không tải được căn nhà.");
      });
    return () => {
      cancelled = true;
    };
  }, [id, invalidId]);

  const back = (
    <Link href="/" className="text-sm text-brand-600 hover:underline">
      ← Danh sách nhà
    </Link>
  );

  if (invalidId || notFound) {
    return (
      <section>
        {back}
        <Alert tone="info" className="mt-6">
          Không tìm thấy căn nhà này.
        </Alert>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {back}
        <Alert className="mt-6">{error}</Alert>
      </section>
    );
  }
  if (!property) return <DetailSkeleton />;

  const pricePerM2 = Number(property.area) > 0 ? Number(property.price) / Number(property.area) : 0;

  return (
    <section>
      {back}
      <div className="mt-4 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <PropertyImage property={property} priority className="aspect-[16/10] rounded-2xl" />
          <h1 className="mt-5 text-2xl font-bold text-slate-900">{property.name}</h1>
          <p className="mt-1 text-slate-600">{property.address}</p>

          <dl className={`mt-5 grid grid-cols-2 gap-4 p-5 text-sm sm:grid-cols-4 ${CARD}`}>
            <div>
              <dt className="text-slate-500">Giá</dt>
              <dd className="mt-1 text-lg font-bold text-brand-700" title={formatVnd(property.price)}>
                {formatBillion(property.price)}
              </dd>
            </div>
            <div>
              <dt className="text-slate-500">Diện tích</dt>
              <dd className="mt-1 font-semibold">{Number(property.area)} m²</dd>
            </div>
            <div>
              <dt className="text-slate-500">Khu vực</dt>
              <dd className="mt-1 font-semibold">{cityOf(property.address)}</dd>
            </div>
            <div>
              <dt className="text-slate-500">Giá mỗi m²</dt>
              <dd className="mt-1 font-semibold">
                {pricePerM2 > 0 ? `${Math.round(pricePerM2 / 1_000_000).toLocaleString("vi-VN")} triệu` : "-"}
              </dd>
            </div>
          </dl>

          {property.description && (
            <div className="mt-6">
              <h2 className="text-lg font-semibold text-slate-900">Mô tả</h2>
              <p className="mt-2 whitespace-pre-line leading-relaxed text-slate-700">{property.description}</p>
            </div>
          )}
        </div>

        <div className="lg:col-span-2">
          {property.status === "AVAILABLE" ? (
            <BookingForm property={property} />
          ) : (
            <Alert tone="warning">Căn này hiện không nhận đặt lịch xem.</Alert>
          )}
        </div>
      </div>
    </section>
  );
}

// Khung giữ chỗ cùng bố cục trang chi tiết
function DetailSkeleton() {
  return (
    <section aria-busy="true" aria-label="Đang tải căn nhà">
      <Skeleton className="h-4 w-28" />
      <div className="mt-4 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <Skeleton className="aspect-[16/10] rounded-2xl" />
          <Skeleton className="mt-5 h-7 w-2/3" />
          <Skeleton className="mt-2 h-4 w-1/2" />
          <Skeleton className="mt-5 h-20 w-full rounded-xl" />
        </div>
        <Skeleton className="h-96 rounded-xl lg:col-span-2" />
      </div>
    </section>
  );
}
