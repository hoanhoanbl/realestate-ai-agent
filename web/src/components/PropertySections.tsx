import type { ReactNode } from "react";
import { Icon, type IconName } from "@/components/ui";
import type { NearbyPlace, Property } from "@/lib/api";
import { basicInfoRows, NEARBY_LABELS } from "@/lib/property";

// Các khối nội dung ở trang chi tiết nhà (FE-31). Khối nào không có dữ liệu thì không hiện

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="mt-8 border-t border-slate-200 pt-6">
      <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
      {children}
    </section>
  );
}

export function BasicInfoSection({ property }: { property: Property }) {
  const rows = basicInfoRows(property);
  return (
    <Section title="Thông tin cơ bản">
      <dl className="mt-3 grid gap-x-8 sm:grid-cols-2">
        {rows.map((r) => (
          <div key={r.label} className="flex items-baseline justify-between gap-4 border-b border-slate-100 py-2.5 text-sm">
            <dt className="text-slate-500">{r.label}</dt>
            <dd className="text-right font-semibold text-slate-900">{r.value}</dd>
          </div>
        ))}
      </dl>
    </Section>
  );
}

export function TagListSection({ title, items }: { title: string; items: string[] | null | undefined }) {
  if (!items || items.length === 0) return null;
  return (
    <Section title={title}>
      <ul className="mt-3 grid gap-x-8 gap-y-2 text-sm text-slate-700 sm:grid-cols-2">
        {items.map((item) => (
          <li key={item} className="flex items-center gap-2">
            <Icon name="check" className="h-4 w-4 shrink-0 text-brand-600" />
            {item}
          </li>
        ))}
      </ul>
    </Section>
  );
}

const NEARBY_ICONS: Record<string, IconName> = {
  SCHOOL: "school",
  HOSPITAL: "hospital",
  MARKET: "market",
  MALL: "mall",
  PARK: "park",
  TRANSPORT: "transport",
  OTHER: "pin",
};

function NearbyList({ places }: { places: NearbyPlace[] }) {
  return (
    <ul className="mt-4 grid gap-2 sm:grid-cols-2">
      {places.map((p, i) => (
        <li key={`${p.category}-${p.name}-${i}`} className="flex items-center gap-3 rounded-lg bg-slate-50 px-3 py-2.5 text-sm">
          <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white text-brand-600 ring-1 ring-slate-200">
            <Icon name={NEARBY_ICONS[p.category] ?? "pin"} className="h-4.5 w-4.5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-medium leading-snug text-slate-900">{p.name}</span>
            <span className="block text-xs text-slate-500">{NEARBY_LABELS[p.category] ?? p.category}</span>
          </span>
          {p.distance && <span className="shrink-0 font-semibold text-slate-700">{p.distance}</span>}
        </li>
      ))}
    </ul>
  );
}

// Bản đồ nhúng Google Maps theo địa chỉ (không cần API key, có sẵn nút "Mở trong Maps") + danh sách dịch vụ xung quanh
export function LocationSection({ property }: { property: Property }) {
  const q = encodeURIComponent(property.address);
  const places = property.nearby ?? [];
  return (
    <Section title="Vị trí và dịch vụ xung quanh">
      <p className="mt-1 flex items-start gap-1.5 text-sm text-slate-600">
        <Icon name="pin" className="mt-0.5 h-4 w-4 shrink-0" />
        {property.address}
      </p>
      <div className="mt-3 overflow-hidden rounded-xl ring-1 ring-slate-200">
        <iframe
          title={`Bản đồ ${property.name}`}
          src={`https://maps.google.com/maps?q=${q}&z=15&hl=vi&output=embed`}
          className="aspect-[16/9] w-full border-0"
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
        />
      </div>
      {places.length > 0 && <NearbyList places={places} />}
    </Section>
  );
}
