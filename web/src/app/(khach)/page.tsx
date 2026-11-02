"use client";

import { useEffect, useMemo, useState } from "react";
import PropertyCard, { PropertyCardSkeleton } from "@/components/PropertyCard";
import { Alert, Button, EmptyState, INPUT } from "@/components/ui";
import { getProperties, type Property } from "@/lib/api";
import {
  CITY_OPTIONS,
  PRICE_RANGES,
  SORT_OPTIONS,
  TYPE_LABELS,
  cityOf,
  inPriceRange,
  matchesQuery,
  sortProperties,
  type SortValue,
} from "@/lib/property";
import { TELEGRAM_BOT_URL } from "@/lib/site";

const SELECT = INPUT.replace("w-full", "w-auto");

export default function HomePage() {
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("ALL");
  const [type, setType] = useState("ALL");
  const [price, setPrice] = useState("ALL");
  const [sort, setSort] = useState<SortValue>("DEFAULT");

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

  const available = useMemo(() => (properties ?? []).filter((p) => p.status !== "HIDDEN"), [properties]);

  const visible = useMemo(
    () =>
      sortProperties(
        available.filter(
          (p) =>
            matchesQuery(p, query) &&
            (city === "ALL" || cityOf(p.address) === city) &&
            (type === "ALL" || p.type === type) &&
            inPriceRange(p, price),
        ),
        sort,
      ),
    [available, query, city, type, price, sort],
  );

  const cityCount = useMemo(() => new Set(available.map((p) => cityOf(p.address))).size, [available]);
  const filtered = query !== "" || city !== "ALL" || type !== "ALL" || price !== "ALL";

  function resetFilters() {
    setQuery("");
    setCity("ALL");
    setType("ALL");
    setPrice("ALL");
  }

  return (
    <section>
      <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-600 px-6 py-10 text-white sm:px-10 sm:py-14">
        {/* Hai vòng tròn mờ trang trí */}
        <div aria-hidden className="absolute -right-16 -top-16 h-64 w-64 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-24 right-32 h-56 w-56 rounded-full bg-white/5" />

        <div className="relative">
          <h1 className="text-3xl font-bold sm:text-4xl">Tìm căn nhà phù hợp với bạn</h1>
          <p className="mt-2 max-w-2xl text-blue-100">
            Chọn một căn, đăng ký giờ xem. Nhân viên xác nhận lịch qua email, bạn không cần chờ điện thoại.
          </p>

          <form
            role="search"
            className="mt-6 flex max-w-2xl gap-2 rounded-xl bg-white p-1.5 shadow-lg"
            onSubmit={(e) => {
              e.preventDefault();
              document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
            }}
          >
            <label htmlFor="q" className="sr-only">
              Tìm theo tên dự án hoặc khu vực
            </label>
            <input
              id="q"
              type="search"
              placeholder="Tên dự án, quận, thành phố..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-w-0 flex-1 rounded-lg px-3 py-2 text-slate-900 outline-none placeholder:text-slate-400"
            />
            <Button type="submit">Tìm</Button>
          </form>

          {properties && (
            <p className="mt-4 flex flex-wrap gap-x-4 gap-y-1 text-sm text-blue-100">
              <span>{available.length} căn đang bán</span>
              <span>·</span>
              <span>{cityCount} khu vực</span>
              <span>·</span>
              <a href={TELEGRAM_BOT_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-white underline-offset-2 hover:underline">
                Hỏi trợ lý AI qua Telegram →
              </a>
            </p>
          )}
        </div>
      </div>

      <div id="ket-qua" className="mt-6 flex scroll-mt-20 flex-wrap items-center gap-3">
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
        {filtered && (
          <Button variant="ghost" size="sm" onClick={resetFilters}>
            Xoá lọc
          </Button>
        )}
        <div className="ml-auto flex items-center gap-3">
          {properties && <p className="text-sm text-slate-500">{visible.length} căn phù hợp</p>}
          <select aria-label="Sắp xếp" className={SELECT} value={sort} onChange={(e) => setSort(e.target.value as SortValue)}>
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {error && <Alert className="mt-4">{error}</Alert>}

      {properties !== null && visible.length === 0 && (
        <EmptyState
          className="mt-6"
          title="Không có căn nào khớp"
          description={query ? `Không tìm thấy "${query}". Thử từ khoá khác hoặc nới bộ lọc.` : "Hãy thử chọn thành phố khác hoặc nới khoảng giá."}
          action={
            <Button variant="secondary" onClick={resetFilters}>
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
