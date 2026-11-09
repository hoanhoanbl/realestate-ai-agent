"use client";

import { useState, type KeyboardEvent } from "react";
import { isHttpUrl } from "@/components/PanoramaRoomsEditor";
import { Button, Field, Icon, INPUT } from "@/components/ui";
import type { NearbyPlace, Property, PropertyInput } from "@/lib/api";
import {
  DIRECTION_LABELS,
  FEATURE_SUGGESTIONS,
  FURNISHING_LABELS,
  FURNITURE_SUGGESTIONS,
  LEGAL_LABELS,
  NEARBY_LABELS,
  OCCUPANCY_LABELS,
} from "@/lib/property";

// Phần form "thông tin chi tiết" của Quản lý nhà (FE-31). Giới hạn khớp backend/src/properties/property-options.ts
const MAX_IMAGES = 20;
const MAX_TAGS = 30;
const MAX_NEARBY = 20;

export interface ExtraForm {
  bedrooms: string;
  bathrooms: string;
  floors: string;
  landArea: string;
  floorArea: string;
  roadWidth: string;
  direction: string;
  legalStatus: string;
  furnishing: string;
  occupancy: string;
  images: string[];
  features: string[];
  furniture: string[];
  nearby: NearbyPlace[];
}

export const EMPTY_EXTRA: ExtraForm = {
  bedrooms: "",
  bathrooms: "",
  floors: "",
  landArea: "",
  floorArea: "",
  roadWidth: "",
  direction: "",
  legalStatus: "",
  furnishing: "",
  occupancy: "",
  images: [],
  features: [],
  furniture: [],
  nearby: [],
};

const str = (v: string | number | null | undefined) => (v === null || v === undefined ? "" : String(Number(v)));

export function extraFromProperty(p: Property): ExtraForm {
  return {
    bedrooms: str(p.bedrooms),
    bathrooms: str(p.bathrooms),
    floors: str(p.floors),
    landArea: str(p.landArea),
    floorArea: str(p.floorArea),
    roadWidth: str(p.roadWidth),
    direction: p.direction ?? "",
    legalStatus: p.legalStatus ?? "",
    furnishing: p.furnishing ?? "",
    occupancy: p.occupancy ?? "",
    images: p.images ?? [],
    features: p.features ?? [],
    furniture: p.furniture ?? [],
    nearby: p.nearby ?? [],
  };
}

type ExtraInput = Pick<
  PropertyInput,
  | "bedrooms"
  | "bathrooms"
  | "floors"
  | "landArea"
  | "floorArea"
  | "roadWidth"
  | "direction"
  | "legalStatus"
  | "furnishing"
  | "occupancy"
  | "images"
  | "features"
  | "furniture"
  | "nearby"
>;

// Kiểm tra và đổi sang dữ liệu gửi backend. Ô trống = null (xoá), mảng rỗng = xoá hết
export function extraToInput(f: ExtraForm): { input?: ExtraInput; error?: string } {
  const num = (label: string, raw: string, opts: { int?: boolean; min: number }) => {
    const v = raw.trim().replace(",", ".");
    if (v === "") return { value: null };
    const n = Number(v);
    if (!Number.isFinite(n) || n < opts.min || (opts.int && !Number.isInteger(n))) {
      return { error: `${label} phải là số ${opts.int ? "nguyên " : ""}${opts.min === 0 ? "từ 0 trở lên" : "lớn hơn 0"}.` };
    }
    return { value: n };
  };
  const fields = {
    bedrooms: num("Số phòng ngủ", f.bedrooms, { int: true, min: 0 }),
    bathrooms: num("Số phòng tắm", f.bathrooms, { int: true, min: 0 }),
    floors: num("Số tầng", f.floors, { int: true, min: 1 }),
    landArea: num("Diện tích đất", f.landArea, { min: 0.01 }),
    floorArea: num("Diện tích sàn", f.floorArea, { min: 0.01 }),
    roadWidth: num("Đường trước nhà", f.roadWidth, { min: 0.01 }),
  };
  for (const r of Object.values(fields)) if (r.error) return { error: r.error };

  const images = f.images.map((u) => u.trim()).filter(Boolean);
  if (images.length > MAX_IMAGES) return { error: `Tối đa ${MAX_IMAGES} ảnh thêm.` };
  const badImage = images.find((u) => !isHttpUrl(u));
  if (badImage) return { error: `Link ảnh "${badImage}" phải bắt đầu bằng http:// hoặc https://` };

  const nearby = f.nearby
    .map((n) => ({ category: n.category, name: n.name.trim(), distance: n.distance.trim() }))
    .filter((n) => n.name !== "" || n.distance !== "");
  if (nearby.some((n) => !n.name)) return { error: "Dịch vụ xung quanh: dòng nào có khoảng cách thì phải có tên." };

  return {
    input: {
      bedrooms: fields.bedrooms.value ?? null,
      bathrooms: fields.bathrooms.value ?? null,
      floors: fields.floors.value ?? null,
      landArea: fields.landArea.value ?? null,
      floorArea: fields.floorArea.value ?? null,
      roadWidth: fields.roadWidth.value ?? null,
      direction: f.direction || null,
      legalStatus: f.legalStatus || null,
      furnishing: f.furnishing || null,
      occupancy: f.occupancy || null,
      images,
      features: f.features,
      furniture: f.furniture,
      nearby,
    },
  };
}

function GroupTitle({ children }: { children: string }) {
  return <h3 className="mt-2 border-t border-brand-100 pt-4 text-sm font-semibold text-slate-900 sm:col-span-2">{children}</h3>;
}

function NumberField({ id, label, value, onChange, step = "1" }: { id: string; label: string; value: string; onChange: (v: string) => void; step?: string }) {
  return (
    <Field id={id} label={label}>
      <input id={id} type="number" min={0} step={step} inputMode="decimal" className={INPUT} value={value} onChange={(e) => onChange(e.target.value)} />
    </Field>
  );
}

function SelectField({ id, label, value, options, onChange }: { id: string; label: string; value: string; options: Record<string, string>; onChange: (v: string) => void }) {
  return (
    <Field id={id} label={label}>
      <select id={id} className={INPUT} value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Chưa nhập</option>
        {Object.entries(options).map(([v, l]) => (
          <option key={v} value={v}>
            {l}
          </option>
        ))}
      </select>
    </Field>
  );
}

// Bấm gợi ý để chọn/bỏ, hoặc gõ mục khác rồi Enter
function TagPicker({ id, label, value, suggestions, onChange }: { id: string; label: string; value: string[]; suggestions: string[]; onChange: (v: string[]) => void }) {
  const [draft, setDraft] = useState("");
  const toggle = (item: string) => onChange(value.includes(item) ? value.filter((v) => v !== item) : [...value, item]);
  const add = () => {
    const item = draft.trim();
    if (item && !value.includes(item) && value.length < MAX_TAGS) onChange([...value, item]);
    setDraft("");
  };
  const onKey = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      add();
    }
  };
  const extras = value.filter((v) => !suggestions.includes(v));
  return (
    <div className="sm:col-span-2">
      <label htmlFor={id} className="mb-1 block text-sm font-medium text-slate-700">
        {label}
      </label>
      <div className="flex flex-wrap gap-2">
        {[...suggestions, ...extras].map((item) => {
          const on = value.includes(item);
          return (
            <button
              key={item}
              type="button"
              aria-pressed={on}
              onClick={() => toggle(item)}
              className={`inline-flex min-h-11 items-center gap-1 rounded-full px-3 text-sm ring-1 transition sm:min-h-8 ${
                on ? "bg-brand-600 text-white ring-brand-600" : "bg-white text-slate-600 ring-slate-300 hover:ring-brand-400"
              }`}
            >
              <Icon name={on ? "check" : "plus"} className="h-3.5 w-3.5" />
              {item}
            </button>
          );
        })}
      </div>
      <div className="mt-2 flex gap-2">
        <input id={id} placeholder="Mục khác, gõ rồi Enter" maxLength={50} className={INPUT} value={draft} onChange={(e) => setDraft(e.target.value)} onKeyDown={onKey} />
        <Button variant="secondary" size="sm" onClick={add} disabled={!draft.trim()}>
          Thêm
        </Button>
      </div>
    </div>
  );
}

function ImagesEditor({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  const update = (i: number, url: string) => onChange(value.map((u, j) => (j === i ? url : u)));
  const move = (i: number, d: -1 | 1) => {
    const j = i + d;
    if (j < 0 || j >= value.length) return;
    const copy = [...value];
    [copy[i], copy[j]] = [copy[j], copy[i]];
    onChange(copy);
  };
  return (
    <div className="sm:col-span-2">
      <p className="mb-1 text-sm font-medium text-slate-700">Ảnh thêm</p>
      <p className="mb-2 text-xs text-slate-500">
        Hiện sau ảnh đại diện, theo thứ tự dưới đây (phòng khách, phòng ngủ, bếp, WC, ban công...). Tối đa {MAX_IMAGES} ảnh.
      </p>
      <div className="space-y-2">
        {value.map((url, i) => (
          <div key={i} className="flex items-center gap-2">
            <span className="h-10 w-14 shrink-0 overflow-hidden rounded bg-slate-100 ring-1 ring-slate-200">
              {isHttpUrl(url.trim()) && (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={url.trim()} alt="" className="h-full w-full object-cover" />
              )}
            </span>
            <input
              aria-label={`Link ảnh thêm ${i + 1}`}
              type="url"
              placeholder="https://..."
              className={INPUT}
              value={url}
              onChange={(e) => update(i, e.target.value)}
            />
            <Button variant="ghost" size="sm" onClick={() => move(i, -1)} disabled={i === 0} aria-label={`Đưa ảnh ${i + 1} lên`}>
              <Icon name="arrowUp" className="h-4 w-4" />
            </Button>
            <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Xoá
            </Button>
          </div>
        ))}
      </div>
      <Button className="mt-2" variant="secondary" size="sm" disabled={value.length >= MAX_IMAGES} onClick={() => onChange([...value, ""])}>
        + Thêm ảnh
      </Button>
    </div>
  );
}

function NearbyEditor({ value, onChange }: { value: NearbyPlace[]; onChange: (v: NearbyPlace[]) => void }) {
  const update = (i: number, patch: Partial<NearbyPlace>) => onChange(value.map((n, j) => (j === i ? { ...n, ...patch } : n)));
  return (
    <div className="sm:col-span-2">
      <p className="mb-1 text-sm font-medium text-slate-700">Dịch vụ xung quanh</p>
      <p className="mb-2 text-xs text-slate-500">
        Trường học, bệnh viện, chợ, ga tàu... gần căn nhà. Khoảng cách ghi tự do, ví dụ &quot;500 m&quot; hoặc &quot;5 phút đi bộ&quot;. Bản đồ
        ở trang khách tự hiện theo địa chỉ, không cần nhập.
      </p>
      <div className="space-y-2">
        {value.map((n, i) => (
          <div key={i} className="grid gap-2 sm:grid-cols-[11rem_1fr_8rem_auto]">
            <select aria-label={`Nhóm dịch vụ ${i + 1}`} className={INPUT} value={n.category} onChange={(e) => update(i, { category: e.target.value })}>
              {Object.entries(NEARBY_LABELS).map(([v, l]) => (
                <option key={v} value={v}>
                  {l}
                </option>
              ))}
            </select>
            <input
              aria-label={`Tên dịch vụ ${i + 1}`}
              placeholder="Tên, ví dụ Trường Vinschool"
              maxLength={100}
              className={INPUT}
              value={n.name}
              onChange={(e) => update(i, { name: e.target.value })}
            />
            <input
              aria-label={`Khoảng cách ${i + 1}`}
              placeholder="500 m"
              maxLength={30}
              className={INPUT}
              value={n.distance}
              onChange={(e) => update(i, { distance: e.target.value })}
            />
            <Button variant="ghost" size="sm" onClick={() => onChange(value.filter((_, j) => j !== i))}>
              Xoá
            </Button>
          </div>
        ))}
      </div>
      <Button
        className="mt-2"
        variant="secondary"
        size="sm"
        disabled={value.length >= MAX_NEARBY}
        onClick={() => onChange([...value, { category: "SCHOOL", name: "", distance: "" }])}
      >
        + Thêm dịch vụ
      </Button>
    </div>
  );
}

export default function PropertyExtraFields({ value, onChange }: { value: ExtraForm; onChange: (v: ExtraForm) => void }) {
  const set = <K extends keyof ExtraForm>(key: K) => (v: ExtraForm[K]) => onChange({ ...value, [key]: v });
  return (
    <>
      <GroupTitle>Thông tin chi tiết</GroupTitle>
      <div className="grid grid-cols-2 gap-3 sm:col-span-2 sm:grid-cols-3">
        <NumberField id="p-bedrooms" label="Phòng ngủ (0 = studio)" value={value.bedrooms} onChange={set("bedrooms")} />
        <NumberField id="p-bathrooms" label="Phòng tắm, WC" value={value.bathrooms} onChange={set("bathrooms")} />
        <NumberField id="p-floors" label="Số tầng (căn hộ: tầng)" value={value.floors} onChange={set("floors")} />
        <NumberField id="p-land" label="Diện tích đất (m²)" value={value.landArea} onChange={set("landArea")} step="0.1" />
        <NumberField id="p-floor-area" label="Diện tích sàn (m²)" value={value.floorArea} onChange={set("floorArea")} step="0.1" />
        <NumberField id="p-road" label="Đường, hẻm trước nhà (m)" value={value.roadWidth} onChange={set("roadWidth")} step="0.1" />
        <SelectField id="p-direction" label="Hướng" value={value.direction} options={DIRECTION_LABELS} onChange={set("direction")} />
        <SelectField id="p-legal" label="Pháp lý" value={value.legalStatus} options={LEGAL_LABELS} onChange={set("legalStatus")} />
        <SelectField id="p-furnishing" label="Nội thất" value={value.furnishing} options={FURNISHING_LABELS} onChange={set("furnishing")} />
        <SelectField id="p-occupancy" label="Tình trạng sử dụng" value={value.occupancy} options={OCCUPANCY_LABELS} onChange={set("occupancy")} />
      </div>

      <GroupTitle>Ảnh</GroupTitle>
      <ImagesEditor value={value.images} onChange={set("images")} />

      <GroupTitle>Tiện ích và nội thất</GroupTitle>
      <TagPicker id="p-features" label="Tiện ích" value={value.features} suggestions={FEATURE_SUGGESTIONS} onChange={set("features")} />
      <TagPicker id="p-furniture" label="Nội thất bàn giao" value={value.furniture} suggestions={FURNITURE_SUGGESTIONS} onChange={set("furniture")} />

      <GroupTitle>Vị trí</GroupTitle>
      <NearbyEditor value={value.nearby} onChange={set("nearby")} />
    </>
  );
}
