"use client";

import { useEffect, useMemo, useState } from "react";
import PropertyCard, { PropertyCardSkeleton } from "@/components/PropertyCard";
import { Alert, Button, EmptyState, Icon, INPUT } from "@/components/ui";
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

// Ảnh nền khung đầu trang (Unsplash, dùng miễn phí)
const HERO_IMAGE = "https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?auto=format&fit=crop&w=1800&q=70";

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
      {/* Khung đầu trang kiểu Marketplace (skill ui-ux-pro-max): ảnh nhà thật, thanh tìm kiếm là nút chính */}
      <div className="relative isolate overflow-hidden rounded-3xl bg-slate-900 text-white">
        {/* eslint-disable-next-line @next/next/no-img-element -- ảnh nền Unsplash, không cần tối ưu qua next/image */}
        <img src={HERO_IMAGE} alt="" className="absolute inset-0 -z-10 h-full w-full object-cover" />
        <div aria-hidden className="absolute inset-0 -z-10 bg-gradient-to-b from-slate-950/80 via-slate-900/70 to-slate-900/75 sm:bg-gradient-to-r sm:from-slate-950/85 sm:via-slate-900/60 sm:to-slate-900/20" />

        <div className="animate-fade-up px-5 py-12 sm:px-10 sm:py-16 lg:px-14 lg:py-20">
          <p className="inline-flex items-center gap-2 rounded-full bg-white/15 px-3 py-1 text-xs font-medium backdrop-blur sm:text-sm">
            <Icon name="sparkles" className="h-4 w-4" />
            Đặt lịch xem nhà trực tuyến, xác nhận qua email
          </p>
          <h1 className="mt-4 max-w-2xl text-4xl font-bold leading-tight tracking-tight sm:text-5xl lg:text-6xl">
            Tìm căn nhà phù hợp với bạn
          </h1>
          <p className="mt-3 max-w-xl text-base text-slate-200 sm:text-lg">
            Xem ảnh, xem 360° và vị trí từng căn. Chọn giờ rảnh để đăng ký xem, bạn không cần chờ điện thoại.
          </p>

          <form
            role="search"
            className="mt-8 flex max-w-2xl items-center gap-2 rounded-2xl bg-white p-2 shadow-2xl"
            onSubmit={(e) => {
              e.preventDefault();
              document.getElementById("ket-qua")?.scrollIntoView({ block: "start" });
            }}
          >
            <label htmlFor="q" className="sr-only">
              Tìm theo tên dự án hoặc khu vực
            </label>
            <Icon name="search" className="ml-2 h-5 w-5 shrink-0 text-slate-500" />
            <input
              id="q"
              type="search"
              placeholder="Tên dự án, quận, thành phố..."
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="min-h-11 min-w-0 flex-1 rounded-lg px-1 text-base text-slate-900 outline-none placeholder:text-slate-500"
            />
            <Button type="submit" size="lg" className="shrink-0 rounded-xl">
              Tìm
            </Button>
          </form>

          {/* Chọn nhanh loại nhà: dùng chung bộ lọc "Loại nhà" bên dưới */}
          <div className="mt-4 flex flex-wrap gap-2" aria-label="Chọn nhanh loại nhà">
            {Object.entries(TYPE_LABELS).map(([value, label]) => {
              const on = type === value;
              return (
                <button
                  key={value}
                  type="button"
                  aria-pressed={on}
                  onClick={() => {
                    setType(on ? "ALL" : value);
                    document.getElementById("ket-qua")?.scrollIntoView({ block: "start", behavior: "smooth" });
                  }}
                  className={`min-h-11 rounded-full px-4 text-sm font-medium backdrop-blur transition-colors sm:min-h-9 ${
                    on ? "bg-white text-slate-900" : "bg-white/15 text-white hover:bg-white/25"
                  }`}
                >
                  {label}
                </button>
              );
            })}
          </div>

          {properties && (
            <p className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-200">
              <span>
                <b className="text-white">{available.length}</b> căn đang bán
              </span>
              <span aria-hidden>·</span>
              <span>
                <b className="text-white">{cityCount}</b> khu vực
              </span>
              <span aria-hidden>·</span>
              <a
                href={TELEGRAM_BOT_URL}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-11 items-center gap-1 font-medium text-white underline-offset-2 hover:underline sm:min-h-0"
              >
                Hỏi trợ lý AI qua Telegram
                <Icon name="arrowRight" className="h-4 w-4" />
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
