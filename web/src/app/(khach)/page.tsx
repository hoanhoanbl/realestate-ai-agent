"use client";

import { useEffect, useMemo, useState } from "react";
import PropertyCard, { PropertyCardSkeleton } from "@/components/PropertyCard";
import { Alert, Button, EmptyState, INPUT } from "@/components/ui";
import { getProperties, type Property } from "@/lib/api";
import { CITY_OPTIONS, PRICE_RANGES, TYPE_LABELS, cityOf, inPriceRange } from "@/lib/property";

const SELECT = INPUT.replace("w-full", "w-auto");

export default function HomePage() {
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [city, setCity] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [price, setPrice] = useState("ALL");

  useEffect(() => {
    let cancelled = false;
    getProperties()
      .then((data) => {
        if (!cancelled) setProperties(data);
      })
      .catch((e: unknown) => {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : "Không tải được danh sách nhà.");
        }
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const visible = useMemo(
    () =>
      (properties ?? []).filter(
        (p) =>
          p.status !== "HIDDEN" &&
          (city === "ALL" || cityOf(p.address) === city) &&
          (type === "ALL" || p.type === type) &&
          inPriceRange(p, price),
      ),
    [properties, city, type, price],
  );

  return (
    <section>
      <div className="rounded-2xl bg-gradient-to-r from-brand-600 to-indigo-600 px-6 py-10 text-white sm:px-10">
        <h1 className="text-3xl font-bold">Tìm căn nhà phù hợp với bạn</h1>
        <p className="mt-2 max-w-2xl text-blue-100">
          Chọn một căn, đăng ký giờ xem. Nhân viên sẽ xác nhận lịch qua email, bạn không cần
          chờ điện thoại.
        </p>
      </div>

      <div className="mt-6 flex flex-wrap gap-3">
        <select aria-label="Thành phố" className={SELECT} value={city} onChange={(e) => setCity(e.target.value)}>
          <option value="ALL">Mọi thành phố</option>
          {CITY_OPTIONS.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
        <select aria-label="Loại nhà" className={SELECT} value={type} onChange={(e) => setType(e.target.value)}>
          <option value="ALL">Mọi loại nhà</option>
          {Object.entries(TYPE_LABELS).map(([value, label]) => (
            <option key={value} value={value}>
              {label}
            </option>
          ))}
        </select>
        <select aria-label="Khoảng giá" className={SELECT} value={price} onChange={(e) => setPrice(e.target.value)}>
          {PRICE_RANGES.map((r) => (
            <option key={r.value} value={r.value}>
              {r.label}
            </option>
          ))}
        </select>
        {properties && (
          <p className="self-center text-sm text-slate-500">{visible.length} căn phù hợp</p>
        )}
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      {properties !== null && visible.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Không có căn nào khớp bộ lọc"
          description="Hãy thử chọn thành phố khác hoặc nới khoảng giá."
          action={
            <Button
              variant="secondary"
              onClick={() => {
                setCity("ALL");
                setType("ALL");
                setPrice("ALL");
              }}
            >
              Xoá bộ lọc
            </Button>
          }
        />
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {properties === null && !error
          ? Array.from({ length: 6 }, (_, i) => <PropertyCardSkeleton key={i} />)
          : visible.map((p, i) => <PropertyCard key={p.id} property={p} priority={i < 3} />)}
      </div>
    </section>
  );
}
