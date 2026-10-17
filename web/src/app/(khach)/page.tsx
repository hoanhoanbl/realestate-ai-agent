"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { formatVnd, getProperties, type Property } from "@/lib/api";
import {
  CITY_OPTIONS,
  PRICE_RANGES,
  TYPE_LABELS,
  cityOf,
  formatBillion,
  inPriceRange,
  typeLabel,
} from "@/lib/property";

const SELECT =
  "rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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
      <div className="rounded-2xl bg-gradient-to-r from-blue-600 to-indigo-600 px-6 py-10 text-white sm:px-10">
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

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {properties === null && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {properties !== null && visible.length === 0 && (
        <p className="mt-6 rounded-lg bg-slate-50 p-4 text-slate-600 ring-1 ring-slate-200">
          Không có căn nào khớp bộ lọc. Hãy thử nới điều kiện.
        </p>
      )}

      <div className="mt-6 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((p) => (
          <Link
            key={p.id}
            href={`/nha/${p.id}`}
            className="group overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm transition hover:shadow-md"
          >
            <div className="flex h-36 items-end bg-gradient-to-br from-slate-200 to-slate-300 p-3">
              <span className="rounded-full bg-white/90 px-2.5 py-0.5 text-xs font-semibold text-slate-700">
                {typeLabel(p.type)}
              </span>
            </div>
            <div className="p-4">
              <h2 className="font-semibold text-slate-900 group-hover:text-blue-700">{p.name}</h2>
              <p className="mt-1 line-clamp-2 text-sm text-slate-500">{p.address}</p>
              <div className="mt-3 flex items-end justify-between">
                <span className="text-lg font-bold text-blue-700" title={formatVnd(p.price)}>
                  {formatBillion(p.price)}
                </span>
                <span className="text-sm text-slate-500">{Number(p.area)} m²</span>
              </div>
            </div>
          </Link>
        ))}
      </div>
    </section>
  );
}
