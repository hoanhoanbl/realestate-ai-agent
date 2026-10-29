"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import BookingForm from "@/components/BookingForm";
import PropertyImage from "@/components/PropertyImage";
import { Alert, CARD, Skeleton } from "@/components/ui";
import { ApiError, formatVnd, getProperty, type Property } from "@/lib/api";
import { cityOf, formatBillion } from "@/lib/property";
import { TELEGRAM_BOT_URL } from "@/lib/site";

const STEPS = [
  { title: "Gửi yêu cầu", text: "Chọn giờ bạn rảnh và để lại thông tin liên hệ." },
  { title: "Nhận xác nhận", text: "Nhân viên duyệt lịch, bạn nhận email xác nhận hoặc đề xuất giờ khác." },
  { title: "Đi xem nhà", text: "Gặp nhân viên tại căn nhà. Sau buổi xem bạn có thể gửi cảm nhận." },
];

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

          <div className="mt-8">
            <h2 className="text-lg font-semibold text-slate-900">Quy trình xem nhà</h2>
            <ol className="mt-3 grid gap-3 sm:grid-cols-3">
              {STEPS.map((step, i) => (
                <li key={step.title} className={`p-4 ${CARD}`}>
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {i + 1}
                  </span>
                  <p className="mt-2 font-semibold text-slate-900">{step.title}</p>
                  <p className="mt-1 text-sm text-slate-600">{step.text}</p>
                </li>
              ))}
            </ol>
          </div>
        </div>

        {/* Trên máy tính form bám theo khi cuộn; scroll-mt chừa chỗ cho thanh điều hướng */}
        <div id="dat-lich" className="scroll-mt-20 lg:col-span-2 lg:sticky lg:top-20 lg:self-start">
          {property.status === "AVAILABLE" ? (
            <BookingForm property={property} />
          ) : (
            <Alert tone="warning">Căn này hiện không nhận đặt lịch xem.</Alert>
          )}
          <a
            href={TELEGRAM_BOT_URL}
            target="_blank"
            rel="noopener noreferrer"
            className={`mt-4 flex items-center gap-3 p-4 transition hover:shadow-card-hover ${CARD}`}
          >
            <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-600">
              <svg viewBox="0 0 24 24" className="h-5 w-5" fill="currentColor" aria-hidden>
                <path d="M21.9 4.3 18.7 19.4c-.2 1.1-.9 1.3-1.8.8l-4.9-3.6-2.4 2.3c-.3.3-.5.5-1 .5l.4-5 9.1-8.2c.4-.4-.1-.6-.6-.2L6.2 13 1.4 11.5c-1-.3-1-1 .2-1.5L20.6 2.8c.9-.3 1.6.2 1.3 1.5Z" />
              </svg>
            </span>
            <span>
              <span className="block font-semibold text-slate-900">Còn thắc mắc về căn này?</span>
              <span className="block text-sm text-slate-600">Hỏi trợ lý AI qua Telegram, trả lời ngay cả ngoài giờ.</span>
            </span>
          </a>
        </div>
      </div>

      {/* Điện thoại: thanh dưới đáy luôn thấy giá và nút đặt lịch */}
      {property.status === "AVAILABLE" && (
        <>
          <div aria-hidden className="h-20 lg:hidden" />
          <div className="fixed inset-x-0 bottom-0 z-40 flex items-center justify-between gap-3 border-t border-slate-200 bg-white/95 px-4 py-3 shadow-[0_-4px_12px_rgb(15_23_42/0.06)] backdrop-blur lg:hidden">
            <div>
              <p className="text-xs text-slate-500">Giá</p>
              <p className="text-lg font-bold text-brand-700">{formatBillion(property.price)}</p>
            </div>
            <a href="#dat-lich" className="rounded-lg bg-brand-600 px-5 py-2.5 font-medium text-white hover:bg-brand-700">
              Đặt lịch xem
            </a>
          </div>
        </>
      )}
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
