"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProperty,
  formatVnd,
  getAdminProperties,
  PROPERTY_STATUS_LABELS,
  updateProperty,
  type PanoramaRoom,
  type Property,
  type PropertyInput,
  type PropertyStatus,
} from "@/lib/api";
import PanoramaRoomsEditor, { cleanRooms, isHttpUrl, validateRooms } from "@/components/PanoramaRoomsEditor";
import PropertyExtraFields, { EMPTY_EXTRA, extraFromProperty, extraToInput, type ExtraForm } from "@/components/PropertyExtraFields";
import PropertyImage from "@/components/PropertyImage";
import { Alert, Button, Field, Icon, INPUT, PageHeader } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { TYPE_LABELS, typeLabel } from "@/lib/property";

interface FormState {
  name: string;
  address: string;
  price: string;
  area: string;
  type: string;
  imageUrl: string;
  description: string;
  panoramas: PanoramaRoom[];
  // Thông tin chi tiết, ảnh thêm, tiện ích, nội thất, dịch vụ xung quanh (FE-31)
  extra: ExtraForm;
}

const EMPTY: FormState = {
  name: "",
  address: "",
  price: "",
  area: "",
  type: "APARTMENT",
  imageUrl: "",
  description: "",
  panoramas: [],
  extra: EMPTY_EXTRA,
};

function toForm(p: Property): FormState {
  return {
    name: p.name,
    address: p.address,
    price: String(Number(p.price)),
    area: String(Number(p.area)),
    type: p.type,
    imageUrl: p.imageUrl ?? "",
    description: p.description ?? "",
    panoramas: p.panoramas ?? [],
    extra: extraFromProperty(p),
  };
}

function validate(f: FormState): string | null {
  if (!f.name.trim()) return "Nhập tên căn nhà.";
  if (!f.address.trim()) return "Nhập địa chỉ.";
  const price = Number(f.price);
  if (!Number.isInteger(price) || price < 1) return "Giá phải là số nguyên dương (VND).";
  if (!(Number(f.area) > 0)) return "Diện tích phải lớn hơn 0.";
  if (f.imageUrl.trim() && !isHttpUrl(f.imageUrl.trim())) return "Link ảnh phải bắt đầu bằng http:// hoặc https://";
  return validateRooms(f.panoramas) ?? extraToInput(f.extra).error ?? null;
}

export default function PropertiesAdminPage() {
  const session = useSession();
  const [items, setItems] = useState<Property[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  // editing: null = đóng form, "new" = thêm mới, số = sửa căn có id đó
  const [editing, setEditing] = useState<number | "new" | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const formRef = useRef<HTMLDivElement>(null);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getAdminProperties()
      .then((data) => {
        if (!cancelled) {
          setItems(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  // Bấm "Sửa" ở dòng cuối bảng thì form nằm trên đầu trang: cuộn tới để người dùng thấy
  useEffect(() => {
    if (editing !== null) formRef.current?.scrollIntoView({ block: "start" });
  }, [editing]);

  if (session && session.user.role !== "MANAGER") {
    return (
      <Alert tone="warning">Chỉ quản lý được thêm, sửa hoặc ẩn căn nhà.</Alert>
    );
  }

  function open(target: number | "new", p?: Property) {
    setEditing(target);
    setForm(p ? toForm(p) : EMPTY);
    setFormError(null);
  }

  async function save() {
    const problem = validate(form);
    if (problem) {
      setFormError(problem);
      return;
    }
    const body: PropertyInput = {
      name: form.name.trim(),
      address: form.address.trim(),
      price: Number(form.price),
      area: Number(form.area),
      type: form.type,
      // Gửi chuỗi rỗng để xoá ảnh/mô tả cũ
      imageUrl: form.imageUrl.trim(),
      description: form.description.trim(),
      // Mảng rỗng = xoá hết phòng 360°
      panoramas: cleanRooms(form.panoramas),
      ...extraToInput(form.extra).input,
    };
    setSaving(true);
    setFormError(null);
    try {
      if (editing === "new") await createProperty(body);
      else if (typeof editing === "number") await updateProperty(editing, body);
      setEditing(null);
      reload();
    } catch (e: unknown) {
      setFormError(e instanceof Error ? e.message : "Lưu thất bại.");
    } finally {
      setSaving(false);
    }
  }

  // Đổi trạng thái căn. RESERVED do hợp đồng cọc quyết định nên không có nút; backend báo lỗi nếu còn hợp đồng.
  async function changeStatus(p: Property, next: PropertyStatus) {
    const confirmText: Partial<Record<PropertyStatus, string>> = {
      HIDDEN: `Ẩn "${p.name}" khỏi trang khách? Các lịch xem đã đặt vẫn giữ nguyên.`,
      SOLD: `Đánh dấu "${p.name}" đã bán? Căn sẽ không còn hiện ở trang khách.`,
    };
    if (confirmText[next] && !window.confirm(confirmText[next])) return;
    setError(null);
    try {
      await updateProperty(p.id, { status: next });
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    }
  }

  // Nút thao tác của một căn: dùng chung cho thẻ (điện thoại) và bảng (máy tính)
  const rowActions = (p: Property) => (
      <span className="inline-flex items-center gap-1">
        <Button variant="ghost" size="sm" className="text-brand-600" onClick={() => open(p.id, p)}>
          Sửa
        </Button>
        {p.status === "AVAILABLE" && (
          <Button variant="ghost" size="sm" onClick={() => changeStatus(p, "HIDDEN")}>
            Ẩn
          </Button>
        )}
        {p.status === "HIDDEN" && (
          <Button variant="ghost" size="sm" onClick={() => changeStatus(p, "AVAILABLE")}>
            Hiện lại
          </Button>
        )}
        {p.status === "RESERVED" && (
          <Button variant="ghost" size="sm" className="text-emerald-700" onClick={() => changeStatus(p, "SOLD")}>
            Đã bán
          </Button>
        )}
      </span>
  );

  return (
    <section>
      <PageHeader
        title="Quản lý nhà"
        description="Căn bị ẩn hoặc đã bán không hiện ở trang khách. Căn đang giữ cọc vẫn hiện nhưng không nhận đặt lịch."
        actions={
          <Button onClick={() => open("new")}>
            <Icon name="plus" className="h-4 w-4" />
            Thêm căn nhà
          </Button>
        }
      />

      {error && <Alert className="mt-4">{error}</Alert>}

      {editing !== null && (
        <div ref={formRef} className="mt-5 scroll-mt-24 rounded-xl border border-brand-200 bg-brand-50/50 p-5">
          <h2 className="font-semibold text-slate-900">{editing === "new" ? "Thêm căn nhà" : `Sửa căn #${editing}`}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <Field id="p-name" label="Tên" className="sm:col-span-2">
              <input id="p-name" className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field id="p-address" label="Địa chỉ" className="sm:col-span-2">
              <input id="p-address" className={INPUT} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </Field>
            <Field id="p-price" label="Giá (VND)">
              <input id="p-price" type="number" min={1} className={INPUT} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </Field>
            <Field id="p-area" label="Diện tích (m²)">
              <input id="p-area" type="number" min={1} step="0.1" className={INPUT} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </Field>
            <Field id="p-type" label="Loại">
              <select id="p-type" className={INPUT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </Field>
            <div className="sm:col-span-2 grid gap-3 sm:grid-cols-[1fr_9rem]">
              <Field id="p-image" label="Link ảnh" hint="Dán link ảnh (https://...). Để trống thì trang khách hiện hình minh hoạ theo loại nhà.">
                <input
                  id="p-image"
                  type="url"
                  placeholder="https://..."
                  className={INPUT}
                  value={form.imageUrl}
                  onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
                />
              </Field>
              <PropertyImage
                property={{ name: form.name || "Xem trước", type: form.type, imageUrl: isHttpUrl(form.imageUrl.trim()) ? form.imageUrl.trim() : null }}
                showType={false}
                priority
                className="aspect-[3/2] rounded-lg ring-1 ring-slate-200"
              />
            </div>
            <Field id="p-description" label="Mô tả" hint="Hiện ở trang chi tiết căn nhà, xuống dòng được giữ nguyên. Nên viết 2–3 đoạn: bố trí từng tầng hoặc từng phòng, hiện trạng và nội thất, điểm nổi bật quanh nhà." className="sm:col-span-2">
              <textarea
                id="p-description"
                rows={6}
                maxLength={5000}
                className={INPUT}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
            <PropertyExtraFields value={form.extra} onChange={(extra) => setForm({ ...form, extra })} />
            <PanoramaRoomsEditor value={form.panoramas} onChange={(panoramas) => setForm({ ...form, panoramas })} />
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-rose-600">{formError}</p>}
          {/* Form dài: thanh Lưu / Hủy dính dưới đáy màn hình khi cuộn */}
          <div className="sticky bottom-0 -mx-5 -mb-5 mt-4 flex gap-2 rounded-b-xl border-t border-brand-100 bg-white/95 px-5 py-3 backdrop-blur">
            <Button onClick={save} disabled={saving}>
              {saving ? "Đang lưu..." : "Lưu"}
            </Button>
            <Button variant="ghost" onClick={() => setEditing(null)}>
              Hủy
            </Button>
          </div>
        </div>
      )}

      {items === null && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {items !== null && (
        <>
          {/* Điện thoại: dạng thẻ, nút cao 44px. Máy tính: bảng như cũ */}
          <ul className="mt-5 space-y-3 md:hidden">
            {items.map((p) => (
              <li
                key={p.id}
                className={`rounded-xl border border-slate-200 bg-white p-3 shadow-card ${p.status === "HIDDEN" || p.status === "SOLD" ? "opacity-70" : ""}`}
              >
                <div className="flex gap-3">
                  <PropertyImage property={p} showType={false} className="h-20 w-24 shrink-0 rounded-lg" />
                  <div className="min-w-0 flex-1">
                    <p className="font-semibold leading-snug text-slate-900">{p.name}</p>
                    <p className="mt-0.5 line-clamp-1 text-xs text-slate-500">{p.address}</p>
                    <p className="mt-1 text-sm">
                      <b className="text-brand-700">{formatVnd(p.price)}</b>
                      <span className="text-slate-500"> · {Number(p.area)} m² · {typeLabel(p.type)}</span>
                    </p>
                  </div>
                </div>
                <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-slate-100 pt-3">
                  <span className="mr-auto rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-700">
                    {PROPERTY_STATUS_LABELS[p.status as PropertyStatus] ?? p.status}
                    {(p.panoramas?.length ?? 0) > 0 && <> · 360°: {p.panoramas?.length} phòng</>}
                  </span>
                  {rowActions(p)}
                </div>
              </li>
            ))}
          </ul>

          <div className="mt-5 hidden overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-card md:block">
            <table className="w-full text-left text-sm">
              <thead className="bg-slate-50 text-xs uppercase text-slate-500">
                <tr>
                  <th className="px-3 py-3">#</th>
                  <th className="px-3 py-3">Căn nhà</th>
                  <th className="px-3 py-3">Loại</th>
                  <th className="px-3 py-3">Giá</th>
                  <th className="px-3 py-3">Diện tích</th>
                  <th className="px-3 py-3">Trạng thái</th>
                  <th className="px-3 py-3">
                    <span className="sr-only">Thao tác</span>
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((p) => (
                  <tr key={p.id} className={p.status === "HIDDEN" || p.status === "SOLD" ? "bg-slate-50 text-slate-500" : "hover:bg-slate-50"}>
                    <td className="px-3 py-3">{p.id}</td>
                    <td className="px-3 py-3">
                      <div className="flex items-center gap-3">
                        <PropertyImage property={p} showType={false} className="h-12 w-16 shrink-0 rounded-md" />
                        <div>
                          <div className="font-medium">{p.name}</div>
                          <div className="text-xs">{p.address}</div>
                          {(p.panoramas?.length ?? 0) > 0 && (
                            <div className="mt-0.5 text-xs text-brand-600">360°: {p.panoramas?.length} phòng</div>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="px-3 py-3">{typeLabel(p.type)}</td>
                    <td className="whitespace-nowrap px-3 py-3">{formatVnd(p.price)}</td>
                    <td className="px-3 py-3">{Number(p.area)} m²</td>
                    <td className="px-3 py-3">{PROPERTY_STATUS_LABELS[p.status as PropertyStatus] ?? p.status}</td>
                    <td className="whitespace-nowrap px-3 py-3 text-right">
                      {rowActions(p)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </section>
  );
}
