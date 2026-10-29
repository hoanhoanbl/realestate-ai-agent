"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProperty,
  formatVnd,
  getAdminProperties,
  updateProperty,
  type Property,
  type PropertyInput,
} from "@/lib/api";
import PropertyImage from "@/components/PropertyImage";
import { Alert, Button, Field, INPUT } from "@/components/ui";
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
}

const EMPTY: FormState = { name: "", address: "", price: "", area: "", type: "APARTMENT", imageUrl: "", description: "" };

function toForm(p: Property): FormState {
  return {
    name: p.name,
    address: p.address,
    price: String(Number(p.price)),
    area: String(Number(p.area)),
    type: p.type,
    imageUrl: p.imageUrl ?? "",
    description: p.description ?? "",
  };
}

function isHttpUrl(value: string): boolean {
  try {
    const url = new URL(value);
    return url.protocol === "http:" || url.protocol === "https:";
  } catch {
    return false;
  }
}

function validate(f: FormState): string | null {
  if (!f.name.trim()) return "Nhập tên căn nhà.";
  if (!f.address.trim()) return "Nhập địa chỉ.";
  const price = Number(f.price);
  if (!Number.isInteger(price) || price < 1) return "Giá phải là số nguyên dương (VND).";
  if (!(Number(f.area) > 0)) return "Diện tích phải lớn hơn 0.";
  if (f.imageUrl.trim() && !isHttpUrl(f.imageUrl.trim())) return "Link ảnh phải bắt đầu bằng http:// hoặc https://";
  return null;
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
      <p className="rounded-lg bg-amber-50 p-4 text-amber-800 ring-1 ring-amber-200">
        Chỉ quản lý được thêm, sửa hoặc ẩn căn nhà.
      </p>
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

  async function toggle(p: Property) {
    const next = p.status === "HIDDEN" ? "AVAILABLE" : "HIDDEN";
    if (next === "HIDDEN" && !window.confirm(`Ẩn "${p.name}" khỏi trang khách? Các lịch xem đã đặt vẫn giữ nguyên.`)) return;
    try {
      await updateProperty(p.id, { status: next });
      reload();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    }
  }

  return (
    <section>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản lý nhà</h1>
          <p className="mt-1 text-sm text-slate-600">Căn bị ẩn không hiện ở trang khách và không nhận đặt lịch.</p>
        </div>
        <Button onClick={() => open("new")}>+ Thêm căn nhà</Button>
      </div>

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
            <Field id="p-description" label="Mô tả" hint="Hiện ở trang chi tiết căn nhà. Xuống dòng được giữ nguyên." className="sm:col-span-2">
              <textarea
                id="p-description"
                rows={4}
                maxLength={5000}
                className={INPUT}
                value={form.description}
                onChange={(e) => setForm({ ...form, description: e.target.value })}
              />
            </Field>
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
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
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[760px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Căn nhà</th>
                <th className="px-3 py-3">Loại</th>
                <th className="px-3 py-3">Giá</th>
                <th className="px-3 py-3">Diện tích</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((p) => (
                <tr key={p.id} className={p.status === "HIDDEN" ? "bg-slate-50 text-slate-400" : "hover:bg-slate-50"}>
                  <td className="px-3 py-3">{p.id}</td>
                  <td className="px-3 py-3">
                    <div className="flex items-center gap-3">
                      <PropertyImage property={p} showType={false} className="h-12 w-16 shrink-0 rounded-md" />
                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs">{p.address}</div>
                      </div>
                    </div>
                  </td>
                  <td className="px-3 py-3">{typeLabel(p.type)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatVnd(p.price)}</td>
                  <td className="px-3 py-3">{Number(p.area)} m²</td>
                  <td className="px-3 py-3">{p.status === "HIDDEN" ? "Đã ẩn" : "Đang bán"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <button type="button" onClick={() => open(p.id, p)} className="mr-2 text-brand-600 hover:underline">Sửa</button>
                    <button type="button" onClick={() => toggle(p)} className="text-slate-600 hover:underline">
                      {p.status === "HIDDEN" ? "Hiện lại" : "Ẩn"}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
