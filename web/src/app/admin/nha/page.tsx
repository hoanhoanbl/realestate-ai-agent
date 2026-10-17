"use client";

import { useCallback, useEffect, useState } from "react";
import {
  createProperty,
  formatVnd,
  getAdminProperties,
  updateProperty,
  type Property,
  type PropertyInput,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { TYPE_LABELS, typeLabel } from "@/lib/property";

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

interface FormState {
  name: string;
  address: string;
  price: string;
  area: string;
  type: string;
}

const EMPTY: FormState = { name: "", address: "", price: "", area: "", type: "APARTMENT" };

function toForm(p: Property): FormState {
  return { name: p.name, address: p.address, price: String(Number(p.price)), area: String(Number(p.area)), type: p.type };
}

function validate(f: FormState): string | null {
  if (!f.name.trim()) return "Nhập tên căn nhà.";
  if (!f.address.trim()) return "Nhập địa chỉ.";
  const price = Number(f.price);
  if (!Number.isInteger(price) || price < 1) return "Giá phải là số nguyên dương (VND).";
  if (!(Number(f.area) > 0)) return "Diện tích phải lớn hơn 0.";
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
        <button
          type="button"
          onClick={() => open("new")}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
        >
          + Thêm căn nhà
        </button>
      </div>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}

      {editing !== null && (
        <div className="mt-5 rounded-xl border border-blue-200 bg-blue-50/50 p-5">
          <h2 className="font-semibold text-slate-900">{editing === "new" ? "Thêm căn nhà" : `Sửa căn #${editing}`}</h2>
          <div className="mt-3 grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium" htmlFor="p-name">Tên</label>
              <input id="p-name" className={INPUT} value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </div>
            <div className="sm:col-span-2">
              <label className="mb-1 block text-sm font-medium" htmlFor="p-address">Địa chỉ</label>
              <input id="p-address" className={INPUT} value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="p-price">Giá (VND)</label>
              <input id="p-price" type="number" min={1} className={INPUT} value={form.price} onChange={(e) => setForm({ ...form, price: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="p-area">Diện tích (m²)</label>
              <input id="p-area" type="number" min={1} step="0.1" className={INPUT} value={form.area} onChange={(e) => setForm({ ...form, area: e.target.value })} />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium" htmlFor="p-type">Loại</label>
              <select id="p-type" className={INPUT} value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
                {Object.entries(TYPE_LABELS).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>
          {formError && <p role="alert" className="mt-3 text-sm text-rose-600">{formError}</p>}
          <div className="mt-4 flex gap-2">
            <button type="button" onClick={save} disabled={saving} className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:opacity-60">
              {saving ? "Đang lưu..." : "Lưu"}
            </button>
            <button type="button" onClick={() => setEditing(null)} className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Hủy
            </button>
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
                    <div className="font-medium">{p.name}</div>
                    <div className="text-xs">{p.address}</div>
                  </td>
                  <td className="px-3 py-3">{typeLabel(p.type)}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatVnd(p.price)}</td>
                  <td className="px-3 py-3">{Number(p.area)} m²</td>
                  <td className="px-3 py-3">{p.status === "HIDDEN" ? "Đã ẩn" : "Đang bán"}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-right">
                    <button type="button" onClick={() => open(p.id, p)} className="mr-2 text-blue-600 hover:underline">Sửa</button>
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
