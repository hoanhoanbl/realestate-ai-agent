"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { Alert, Button, CARD, Icon, INPUT, type IconName } from "@/components/ui";
import {
  ApiError,
  createLead,
  formatVnd,
  getAssignees,
  getProperties,
  lookupLeadByPhone,
  type AssigneeOption,
  type CreateLeadInput,
  type LeadLookup,
  type Property,
} from "@/lib/api";
import { useSession } from "@/lib/auth";
import { MANUAL_SOURCES, manualSourceLabel, normalizePhoneInput, type ManualSource } from "@/lib/customer";
import { normalizeText } from "@/lib/property";
import LeadStatusBadge from "@/components/LeadStatusBadge";

// Form nhân viên thêm khách ngoài hệ thống (FE-37). Quy tắc: docs/nghiep-vu/01-tiep-nhan-va-phan-cong.md mục 1.1 và 2.

const SOURCE_ICONS: Partial<Record<ManualSource, IconName>> = {
  hotline: "phone",
  property_sign: "sign",
  walk_in: "building",
  personal_zalo: "chat",
  referral: "users",
};

type Field = "source" | "phone" | "name" | "email" | "budget" | "owner";
type Errors = Partial<Record<Field, string>>;
// Thứ tự ô trên màn hình: dùng để đưa con trỏ tới ô sai đầu tiên
const FIELD_ORDER: Field[] = ["source", "phone", "name", "email", "budget", "owner"];

interface Values {
  source: ManualSource | "";
  phone: string;
  name: string;
  email: string;
  budget: string;
  note: string;
  // null = chưa chọn tay, dùng mặc định (người đang nhập nếu đang nhận khách)
  owner: string | null;
  consent: boolean;
  propertyIds: number[];
}

type Lookup =
  | { state: "idle" }
  | { state: "checking" }
  | { state: "free" }
  | { state: "duplicate"; lead: LeadLookup };

function validate(v: Values & { owner: string }): Errors {
  const e: Errors = {};
  if (!v.source) e.source = "Chọn khách đến từ đâu.";
  if (!v.phone.trim()) e.phone = "Nhập số điện thoại của khách.";
  else if (!normalizePhoneInput(v.phone.trim())) e.phone = "Nhập số điện thoại 8–15 chữ số, ví dụ 0905 123 456.";
  if (!v.name.trim()) e.name = "Nhập họ tên khách.";
  if (v.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email.trim())) e.email = "Email chưa đúng, ví dụ ten@gmail.com.";
  if (v.budget.trim()) {
    const n = Number(v.budget);
    if (!Number.isInteger(n) || n < 0) e.budget = "Ngân sách là số nguyên đồng, ví dụ 3000000000.";
  }
  if (!v.owner) e.owner = "Chọn người phụ trách.";
  return e;
}

const EMPTY: Values = {
  source: "",
  phone: "",
  name: "",
  email: "",
  budget: "",
  note: "",
  owner: null,
  consent: false,
  propertyIds: [],
};

function ErrorText({ id, message }: { id: string; message?: string }) {
  if (!message) return null;
  return (
    <p id={id} className="mt-1 text-xs font-medium text-red-700">
      {message}
    </p>
  );
}

function Legend({ children }: { children: React.ReactNode }) {
  return <legend className="mb-3 px-0 text-sm font-semibold text-slate-900">{children}</legend>;
}

export default function AddCustomerForm() {
  const router = useRouter();
  const session = useSession();
  const me = session?.user;

  const [values, setValues] = useState<Values>(EMPTY);
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [submitted, setSubmitted] = useState(false);
  const [lookup, setLookup] = useState<Lookup>({ state: "idle" });
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const [assignees, setAssignees] = useState<AssigneeOption[] | null>(null);
  const [properties, setProperties] = useState<Property[] | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [propertyQuery, setPropertyQuery] = useState("");


  const showError = (f: Field) => (touched[f] || submitted ? errors[f] : undefined);
  const dirty = useMemo(
    () =>
      Boolean(
        values.source || values.phone || values.name || values.email || values.budget || values.note || values.consent || values.propertyIds.length,
      ),
    [values],
  );

  function set<K extends keyof Values>(key: K, value: Values[K]) {
    setValues((prev) => ({ ...prev, [key]: value }));
  }
  const blur = (f: Field) => () => setTouched((t) => ({ ...t, [f]: true }));

  // Danh sách người phụ trách và danh sách căn
  useEffect(() => {
    let cancelled = false;
    Promise.all([getAssignees(), getProperties()])
      .then(([a, p]) => {
        if (cancelled) return;
        setAssignees(a);
        setProperties(p);
      })
      .catch((e: unknown) => {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : "Không tải được danh sách nhân viên và căn nhà.");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Người phụ trách: người nhập nếu đang nhận khách (hoặc là quản lý), không thì để trống bắt buộc chọn
  const ownerOptions = useMemo(() => {
    if (!assignees) return [];
    const list = assignees.filter((u) => u.acceptingLeads || u.role === "MANAGER");
    return me ? [...list.filter((u) => u.id === me.id), ...list.filter((u) => u.id !== me.id)] : list;
  }, [assignees, me]);

  const defaultOwner = me && ownerOptions.some((u) => u.id === me.id) ? String(me.id) : "";
  const owner = values.owner ?? defaultOwner;
  const errors = validate({ ...values, owner });

  // Tra trùng số điện thoại khi số đã đủ dạng, chờ 400 ms sau lần gõ cuối
  const normalizedPhone = normalizePhoneInput(values.phone.trim());
  useEffect(() => {
    if (!normalizedPhone) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setLookup({ state: "idle" });
      return;
    }
    setLookup({ state: "checking" });
    let cancelled = false;
    const timer = window.setTimeout(() => {
      lookupLeadByPhone(values.phone.trim())
        .then((lead) => {
          if (!cancelled) setLookup(lead ? { state: "duplicate", lead } : { state: "free" });
        })
        .catch(() => {
          // Lỗi tra cứu thì để máy chủ quyết định lúc lưu
          if (!cancelled) setLookup({ state: "idle" });
        });
    }, 400);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
    // chỉ chạy lại khi số chuẩn hoá đổi
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [normalizedPhone]);

  // Báo trước khi đóng tab hoặc tải lại trang lúc đã gõ dữ liệu
  useEffect(() => {
    if (!dirty || saved) return;
    const handler = (e: BeforeUnloadEvent) => {
      e.preventDefault();
    };
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty, saved]);

  const visibleProperties = useMemo(() => {
    const q = normalizeText(propertyQuery.trim());
    return (properties ?? []).filter((p) => !q || normalizeText(`${p.name} ${p.address}`).includes(q));
  }, [properties, propertyQuery]);
  const selectedProperties = useMemo(
    () => (properties ?? []).filter((p) => values.propertyIds.includes(p.id)),
    [properties, values.propertyIds],
  );

  function toggleProperty(id: number) {
    set("propertyIds", values.propertyIds.includes(id) ? values.propertyIds.filter((x) => x !== id) : [...values.propertyIds, id]);
  }

  function focusFirstInvalid(errs: Errors) {
    const first = FIELD_ORDER.find((f) => errs[f]);
    if (!first) return;
    const el = document.getElementById(first === "source" ? "source-hotline" : `field-${first}`);
    el?.focus();
  }

  function leave() {
    if (dirty && !window.confirm("Bỏ thông tin vừa nhập và quay lại danh sách khách?")) return;
    router.push("/admin/leads");
  }

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (saving || saved) return;
    setServerError(null);
    setSubmitted(true);
    const errs = validate({ ...values, owner });
    if (Object.keys(errs).length > 0) {
      focusFirstInvalid(errs);
      return;
    }
    if (lookup.state === "duplicate" || lookup.state === "checking") return;

    // Chỉ gửi các ô đã điền
    const input: CreateLeadInput = {
      name: values.name.trim(),
      phone: values.phone.trim(),
      source: values.source,
      assignedUserId: Number(owner),
      consentMarketing: values.consent,
    };
    if (values.email.trim()) input.email = values.email.trim();
    if (values.budget.trim()) input.budget = Number(values.budget);
    if (values.note.trim()) input.note = values.note.trim();
    if (values.propertyIds.length) input.interestedPropertyIds = values.propertyIds;

    setSaving(true);
    try {
      const result = await createLead(input);
      setSaved(true);
      router.push(`/admin/leads/${result.lead.id}`);
    } catch (e: unknown) {
      setSaving(false);
      if (e instanceof ApiError && e.status === 409) {
        // Có người vừa lưu cùng số: tra lại để hiện link tới hồ sơ đó, giữ nguyên dữ liệu đã nhập
        setServerError(e.message);
        try {
          const lead = await lookupLeadByPhone(values.phone.trim());
          if (lead) setLookup({ state: "duplicate", lead });
        } catch {
          // giữ thông báo của máy chủ
        }
        return;
      }
      setServerError(e instanceof Error ? e.message : "Không lưu được khách. Thử lại sau ít phút.");
    }
  }

  const duplicate = lookup.state === "duplicate" ? lookup.lead : null;
  const blocked = saving || saved || lookup.state === "checking" || duplicate !== null;
  const describe = (f: Field, extra?: string) => [showError(f) ? `err-${f}` : "", extra ?? ""].filter(Boolean).join(" ") || undefined;

  return (
    <form onSubmit={submit} noValidate className={`${CARD} space-y-6`} aria-label="Thêm khách">
      <p className="text-sm text-slate-600">
        Dành cho khách gọi hotline, đến văn phòng, hỏi qua Zalo cá nhân, người quen giới thiệu hoặc đi ngang thấy biển. Mục có <span aria-hidden>*</span>
        <span className="sr-only">dấu sao</span> là bắt buộc.
      </p>

      {loadError && <Alert tone="error">{loadError}</Alert>}

      <fieldset className="min-w-0" aria-describedby={describe("source")}>
        <Legend>Khách đến từ đâu *</Legend>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {MANUAL_SOURCES.map((s) => {
            const selected = values.source === s;
            const icon = SOURCE_ICONS[s];
            return (
              <label key={s} className="relative block min-w-0">
                <input
                  id={`source-${s}`}
                  type="radio"
                  name="source"
                  value={s}
                  checked={selected}
                  onChange={() => set("source", s)}
                  onBlur={blur("source")}
                  className="peer sr-only"
                />
                <span
                  className={`flex min-h-11 cursor-pointer items-center gap-2 rounded-lg border px-3 py-2 text-sm transition peer-focus-visible:ring-4 peer-focus-visible:ring-brand-200 ${
                    selected
                      ? "border-brand-600 bg-brand-50 font-semibold text-brand-700"
                      : "border-slate-300 bg-white text-slate-700 hover:border-brand-400"
                  }`}
                >
                  {icon && <Icon name={icon} className="h-5 w-5 shrink-0" />}
                  <span className="min-w-0 flex-1">{manualSourceLabel(s)}</span>
                  {selected && <Icon name="check" className="h-4 w-4 shrink-0" />}
                </span>
              </label>
            );
          })}
        </div>
        <ErrorText id="err-source" message={showError("source")} />
      </fieldset>

      <fieldset className="min-w-0">
        <Legend>Liên hệ</Legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="field-phone" className="mb-1 block text-sm font-medium text-slate-700">
              Số điện thoại *
            </label>
            <input
              id="field-phone"
              type="tel"
              inputMode="tel"
              autoComplete="off"
              className={INPUT}
              value={values.phone}
              onChange={(e) => set("phone", e.target.value)}
              onBlur={blur("phone")}
              placeholder="0905 123 456"
              aria-invalid={showError("phone") ? true : undefined}
              aria-describedby={describe("phone", "phone-status")}
            />
            <ErrorText id="err-phone" message={showError("phone")} />
          </div>
          <div className="min-w-0">
            <label htmlFor="field-name" className="mb-1 block text-sm font-medium text-slate-700">
              Họ tên *
            </label>
            <input
              id="field-name"
              type="text"
              autoComplete="off"
              className={INPUT}
              value={values.name}
              onChange={(e) => set("name", e.target.value)}
              onBlur={blur("name")}
              placeholder="Trần Thị Bình"
              aria-invalid={showError("name") ? true : undefined}
              aria-describedby={describe("name")}
            />
            <ErrorText id="err-name" message={showError("name")} />
          </div>
        </div>

        {/* Một vùng thông báo cho tra trùng, để trình đọc màn hình đọc kết quả mà không đổi con trỏ */}
        <div id="phone-status" role="status" aria-live="polite" className="mt-3">
          {lookup.state === "checking" && <p className="text-xs text-slate-500">Đang kiểm tra số…</p>}
          {duplicate && (
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 rounded-lg bg-amber-50 p-3 text-sm text-amber-800 ring-1 ring-amber-200">
              <Icon name="alert" className="h-5 w-5 shrink-0" />
              <p className="min-w-0 flex-1 [overflow-wrap:anywhere]">
                Số này đã có: lead #{duplicate.id} {duplicate.name}, đang do {duplicate.assignedUserName ?? "chưa có nhân viên"} phụ trách.
              </p>
              <LeadStatusBadge status={duplicate.status} />
              <Link
                href={`/admin/leads/${duplicate.id}`}
                className="inline-flex min-h-11 items-center rounded-lg px-3 font-medium text-brand-700 underline sm:min-h-9"
              >
                Mở hồ sơ #{duplicate.id}
              </Link>
            </div>
          )}
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="field-email" className="mb-1 block text-sm font-medium text-slate-700">
              Email (không bắt buộc)
            </label>
            <input
              id="field-email"
              type="email"
              inputMode="email"
              autoComplete="off"
              className={INPUT}
              value={values.email}
              onChange={(e) => set("email", e.target.value)}
              onBlur={blur("email")}
              placeholder="binh@gmail.com"
              aria-invalid={showError("email") ? true : undefined}
              aria-describedby={describe("email")}
            />
            <ErrorText id="err-email" message={showError("email")} />
          </div>
          <div className="min-w-0">
            <label htmlFor="field-budget" className="mb-1 block text-sm font-medium text-slate-700">
              Ngân sách, đồng (không bắt buộc)
            </label>
            <input
              id="field-budget"
              type="text"
              inputMode="numeric"
              autoComplete="off"
              className={INPUT}
              value={values.budget}
              onChange={(e) => set("budget", e.target.value.replace(/[.,\s]/g, ""))}
              onBlur={blur("budget")}
              placeholder="3000000000"
              aria-invalid={showError("budget") ? true : undefined}
              aria-describedby={describe("budget", "hint-budget")}
            />
            <p id="hint-budget" className="mt-1 text-xs text-slate-500">
              {values.budget && !errors.budget ? `= ${formatVnd(Number(values.budget))}` : "Bỏ trống nếu khách chưa nói."}
            </p>
            <ErrorText id="err-budget" message={showError("budget")} />
          </div>
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <Legend>Nhu cầu</Legend>
        <div>
          <label htmlFor="property-search" className="mb-1 block text-sm font-medium text-slate-700">
            Căn quan tâm (chọn được nhiều căn)
          </label>
          {selectedProperties.length > 0 && (
            <ul className="mb-2 flex flex-wrap gap-2" aria-label="Các căn đã chọn">
              {selectedProperties.map((p) => (
                <li key={p.id} className="inline-flex items-center gap-1 rounded-full bg-brand-50 py-1 pl-3 pr-1 text-sm text-brand-700 ring-1 ring-brand-200">
                  <span className="max-w-[16rem] truncate">{p.name}</span>
                  <button
                    type="button"
                    onClick={() => toggleProperty(p.id)}
                    aria-label={`Bỏ căn ${p.name}`}
                    className="flex h-11 w-11 items-center justify-center rounded-full hover:bg-brand-100 focus-visible:ring-4 focus-visible:ring-brand-200 outline-none sm:h-8 sm:w-8"
                  >
                    <Icon name="close" className="h-4 w-4" />
                  </button>
                </li>
              ))}
            </ul>
          )}
          <input
            id="property-search"
            type="search"
            autoComplete="off"
            className={INPUT}
            value={propertyQuery}
            onChange={(e) => setPropertyQuery(e.target.value)}
            placeholder="Gõ tên căn hoặc khu vực để lọc"
          />
          <div className="mt-2 max-h-48 overflow-y-auto rounded-lg border border-slate-200" role="group" aria-label="Danh sách căn">
            {!properties && !loadError && <p className="p-3 text-sm text-slate-500">Đang tải danh sách căn…</p>}
            {properties && visibleProperties.length === 0 && <p className="p-3 text-sm text-slate-500">Không có căn nào khớp.</p>}
            {visibleProperties.map((p) => (
              <label key={p.id} className="flex min-h-11 cursor-pointer items-center gap-3 border-b border-slate-100 px-3 py-2 text-sm last:border-b-0 hover:bg-slate-50">
                <input
                  type="checkbox"
                  checked={values.propertyIds.includes(p.id)}
                  onChange={() => toggleProperty(p.id)}
                  className="h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
                />
                <span className="min-w-0 flex-1">
                  <span className="block truncate font-medium text-slate-800">{p.name}</span>
                  <span className="block truncate text-xs text-slate-500">{p.address}</span>
                </span>
              </label>
            ))}
          </div>
        </div>
        <div className="mt-4">
          <label htmlFor="field-note" className="mb-1 block text-sm font-medium text-slate-700">
            Ghi chú cuộc gọi (không bắt buộc)
          </label>
          <textarea
            id="field-note"
            rows={3}
            autoComplete="off"
            className={INPUT}
            value={values.note}
            onChange={(e) => set("note", e.target.value)}
            placeholder="Cần 2 phòng ngủ gần trường học, muốn xem cuối tuần"
          />
        </div>
      </fieldset>

      <fieldset className="min-w-0">
        <Legend>Phụ trách</Legend>
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label htmlFor="field-owner" className="mb-1 block text-sm font-medium text-slate-700">
              Người phụ trách *
            </label>
            <select
              id="field-owner"
              className={INPUT}
              value={owner}
              onChange={(e) => set("owner", e.target.value)}
              onBlur={blur("owner")}
              disabled={!assignees}
              aria-invalid={showError("owner") ? true : undefined}
              aria-describedby={describe("owner", "hint-owner")}
            >
              <option value="">{assignees ? "Chọn người phụ trách" : "Đang tải…"}</option>
              {ownerOptions.map((u) => (
                <option key={u.id} value={u.id}>
                  {me && u.id === me.id ? `Tôi (${u.name})` : u.name}
                  {u.role === "MANAGER" && !/quản lý/i.test(u.name) ? " · Quản lý" : ""}
                </option>
              ))}
            </select>
            <p id="hint-owner" className="mt-1 text-xs text-slate-500">
              Chỉ hiện người đang nhận khách và quản lý.
            </p>
            <ErrorText id="err-owner" message={showError("owner")} />
          </div>
          <div className="flex min-w-0 items-start sm:pt-7">
            <label className="flex min-h-11 cursor-pointer items-start gap-3 text-sm text-slate-700">
              <input
                type="checkbox"
                checked={values.consent}
                onChange={(e) => set("consent", e.target.checked)}
                className="mt-0.5 h-5 w-5 shrink-0 rounded border-slate-300 text-brand-600 focus:ring-brand-500"
              />
              <span>Khách đồng ý nhận bản tin và gợi ý bất động sản</span>
            </label>
          </div>
        </div>
      </fieldset>

      {serverError && <Alert tone="error">{serverError}</Alert>}

      <div className="flex flex-col-reverse gap-3 border-t border-slate-200 pt-4 sm:flex-row sm:items-center sm:justify-end">
        {duplicate && (
          <p className="text-sm text-amber-800 sm:mr-auto">
            Chưa lưu được vì số này đã có hồ sơ.{" "}
            <Link href={`/admin/leads/${duplicate.id}`} className="font-medium underline">
              Mở hồ sơ #{duplicate.id}
            </Link>
          </p>
        )}
        <Button variant="secondary" onClick={leave} disabled={saving || saved} className="w-full sm:w-auto">
          Huỷ
        </Button>
        <Button type="submit" disabled={blocked} className="w-full sm:w-auto">
          {saved ? (
            <>
              <Icon name="check" className="h-4 w-4" /> Đã lưu
            </>
          ) : saving ? (
            "Đang lưu…"
          ) : (
            "Lưu khách"
          )}
        </Button>
      </div>
    </form>
  );
}
