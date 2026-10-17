"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BookingForm from "@/components/BookingForm";
import { ApiError, formatVnd, getProperty, type Property } from "@/lib/api";
import { cityOf, typeLabel } from "@/lib/property";

// useParams() cần nằm trong Suspense vì `id` chỉ biết lúc người dùng mở trang
export default function PropertyDetailPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
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
    <Link href="/" className="text-sm text-blue-600 hover:underline">
      ← Danh sách nhà
    </Link>
  );

  if (invalidId || notFound) {
    return (
      <section>
        {back}
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">
          Không tìm thấy căn nhà này.
        </p>
      </section>
    );
  }
  if (error) {
    return (
      <section>
        {back}
        <p role="alert" className="mt-6 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      </section>
    );
  }
  if (!property) return <p className="text-slate-500">Đang tải...</p>;

  const pricePerM2 = Number(property.area) > 0 ? Number(property.price) / Number(property.area) : 0;

  return (
    <section>
      {back}
      <div className="mt-4 grid gap-8 lg:grid-cols-5">
        <div className="lg:col-span-3">
          <div className="flex h-64 items-end rounded-2xl bg-gradient-to-br from-slate-200 to-slate-300 p-4">
            <span className="rounded-full bg-white/90 px-3 py-1 text-sm font-semibold text-slate-700">
              {typeLabel(property.type)}
            </span>
          </div>
          <h1 className="mt-5 text-2xl font-bold text-slate-900">{property.name}</h1>
          <p className="mt-1 text-slate-600">{property.address}</p>

          <dl className="mt-5 grid grid-cols-2 gap-4 rounded-xl border border-slate-200 bg-white p-5 text-sm sm:grid-cols-4">
            <div>
              <dt className="text-slate-500">Giá</dt>
              <dd className="mt-1 text-lg font-bold text-blue-700">{formatVnd(property.price)}</dd>
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
        </div>

        <div className="lg:col-span-2">
          {property.status === "AVAILABLE" ? (
            <BookingForm property={property} />
          ) : (
            <p className="rounded-xl bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200">
              Căn này hiện không nhận đặt lịch xem.
            </p>
          )}
        </div>
      </div>
    </section>
  );
}
