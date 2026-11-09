"use client";

import { useCallback, useEffect, useState } from "react";
import { createUser, formatDateTime, getUsers, type UserAccount } from "@/lib/api";
import { useSession, type Role } from "@/lib/auth";
import { Button, Icon, PageHeader } from "@/components/ui";

const INPUT =
  "w-full min-h-11 rounded-lg border border-slate-300 bg-white px-3 py-2 text-base text-slate-900 sm:min-h-10 sm:text-sm outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

interface FormState {
  email: string;
  name: string;
  password: string;
  role: Role;
}

const EMPTY_FORM: FormState = {
  email: "",
  name: "",
  password: "",
  role: "SALE",
};

interface PermissionRow {
  feature: string;
  description: string;
  sale: boolean;
  manager: boolean;
}

// Khớp bảng "Vai trò và quyền" ở docs/nghiep-vu/vai-tro-va-trang-thai.md mục 3. Quyền thật do backend kiểm, bảng này để đối chiếu
const PERMISSIONS_MATRIX: PermissionRow[] = [
  {
    feature: "Xem khách, lịch xem, hợp đồng, số liệu tổng quan",
    description: "Danh sách và chi tiết khách, mức AI chấm, lịch xem nhà, hợp đồng, việc cần làm trên trang Tổng quan",
    sale: true,
    manager: true,
  },
  {
    feature: "Duyệt lịch, đổi giờ xem",
    description: "Duyệt lịch khách đặt hoặc đổi sang giờ khác; khách nhận email chốt lịch hoặc báo giờ mới",
    sale: true,
    manager: true,
  },
  {
    feature: "Điểm danh buổi xem",
    description: "Ghi nhận khách có đến hay không, từ 30 phút trước giờ hẹn trở đi",
    sale: true,
    manager: true,
  },
  {
    feature: "Đánh dấu \"Không mua\"",
    description: "Đóng khách kèm lý do",
    sale: true,
    manager: true,
  },
  {
    feature: "Lập hợp đồng đặt cọc",
    description: "Lập hợp đồng cho khách đã xem nhà; AI soạn và rà nội dung",
    sale: true,
    manager: true,
  },
  {
    feature: "Duyệt hoặc từ chối hợp đồng",
    description: "Duyệt để gửi link ký cho khách, hoặc từ chối kèm lý do",
    sale: false,
    manager: true,
  },
  {
    feature: "Xác nhận tiền cọc, đánh dấu căn đã bán",
    description: "\"Đã nhận tiền cọc\" sau khi khách ký; căn \"Đã bán\" khi hợp đồng của căn đã ký",
    sale: false,
    manager: true,
  },
  {
    feature: "Quản lý nhà",
    description: "Thêm, sửa, ẩn căn nhà; ảnh, 360°, thông tin chi tiết",
    sale: false,
    manager: true,
  },
  {
    feature: "Báo cáo tuần",
    description: "Xem báo cáo AI hằng tuần, bấm tạo báo cáo ngay",
    sale: false,
    manager: true,
  },
  {
    feature: "Tạo tài khoản nhân viên",
    description: "Thêm tài khoản và chọn vai trò",
    sale: false,
    manager: true,
  },
];

export default function PermissionsPage() {
  const session = useSession();
  const [users, setUsers] = useState<UserAccount[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [version, setVersion] = useState(0);

  const reload = useCallback(() => setVersion((v) => v + 1), []);

  useEffect(() => {
    let cancelled = false;
    getUsers()
      .then((data) => {
        if (!cancelled) {
          setUsers(data);
          setError(null);
        }
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi khi tải danh sách người dùng.");
      });
    return () => {
      cancelled = true;
    };
  }, [version]);

  if (session && session.user.role !== "MANAGER") {
    return (
      <div className="rounded-xl border border-amber-200 bg-amber-50 p-6 text-amber-800">
        <h2 className="text-lg font-bold">Không có quyền truy cập</h2>
        <p className="mt-2 text-sm">
          Trang quản trị tài khoản và phân quyền chỉ dành riêng cho tài khoản có vai trò <b>Quản lý (MANAGER)</b>.
        </p>
      </div>
    );
  }

  async function handleCreateUser(e: React.FormEvent) {
    e.preventDefault();
    if (!form.name.trim()) {
      setFormError("Họ tên không được để trống.");
      return;
    }
    if (!form.email.trim() || !form.email.includes("@")) {
      setFormError("Email không hợp lệ.");
      return;
    }
    if (form.password.length < 6) {
      setFormError("Mật khẩu phải từ 6 ký tự trở lên.");
      return;
    }

    setSaving(true);
    setFormError(null);
    try {
      await createUser(form);
      setSuccessMsg(`Đã tạo thành công tài khoản cho ${form.name} (${form.email}).`);
      setShowModal(false);
      setForm(EMPTY_FORM);
      reload();
    } catch (err: unknown) {
      setFormError(err instanceof Error ? err.message : "Không thể tạo tài khoản.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-8">
      <PageHeader
        title="Tài khoản và phân quyền"
        description="Tài khoản nhân viên, vai trò và bảng đối chiếu quyền của từng vai trò."
        actions={
          <Button
            onClick={() => {
              setShowModal(true);
              setFormError(null);
            }}
          >
            <Icon name="plus" className="h-4 w-4" />
            Thêm nhân sự
          </Button>
        }
      />

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{error}</div>
      )}

      {/* Danh sách tài khoản. Cột trạng thái app điện thoại ẩn đến khi làm app (FE-27) */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-bold text-slate-900">Tài khoản</h2>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            {users ? users.length : "..."} tài khoản
          </span>
        </div>

        {!users ? (
          <p className="py-6 text-center text-sm text-slate-500">Đang tải danh sách tài khoản...</p>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Chưa có tài khoản nào.</p>
        ) : (
          <>
            {/* Điện thoại: dạng thẻ */}
            <ul className="space-y-2 md:hidden">
              {users.map((u) => (
                <li key={u.id} className="flex items-center gap-3 rounded-lg border border-slate-200 p-3">
                  <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-50 text-sm font-bold text-brand-700">
                    {u.name.trim().charAt(0).toUpperCase()}
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-slate-900">{u.name}</span>
                    <span className="block text-xs text-slate-600 [overflow-wrap:anywhere]">{u.email}</span>
                  </span>
                  <RoleBadge role={u.role} />
                </li>
              ))}
            </ul>

            <div className="hidden overflow-x-auto md:block">
              <table className="w-full text-left text-sm">
                <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                  <tr>
                    <th className="px-4 py-3">Họ và tên</th>
                    <th className="px-4 py-3">Email đăng nhập</th>
                    <th className="px-4 py-3">Vai trò</th>
                    <th className="px-4 py-3">Ngày tạo</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 text-slate-700">
                  {users.map((u) => (
                    <tr key={u.id} className="hover:bg-slate-50/80">
                      <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                      <td className="px-4 py-3 text-slate-600">{u.email}</td>
                      <td className="px-4 py-3">
                        <RoleBadge role={u.role} />
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(u.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </section>

      {/* Bảng đối chiếu quyền */}
      <section className="rounded-xl border border-slate-200 bg-white p-4 shadow-card sm:p-6">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Quyền của từng vai trò</h2>
          <p className="mt-1 text-sm text-slate-500">Hệ thống kiểm quyền ở máy chủ; bảng này để đối chiếu.</p>
        </div>

        {/* Điện thoại: mỗi quyền một thẻ, hai nhãn vai trò bên dưới */}
        <ul className="space-y-2 md:hidden">
          {PERMISSIONS_MATRIX.map((row) => (
            <li key={row.feature} className="rounded-lg border border-slate-200 p-3">
              <p className="font-semibold text-slate-900">{row.feature}</p>
              <p className="mt-0.5 text-sm text-slate-600">{row.description}</p>
              <div className="mt-2 flex flex-wrap gap-2 text-xs font-medium">
                <Allowed ok={row.sale} label="Nhân viên" />
                <Allowed ok={row.manager} label="Quản lý" />
              </div>
            </li>
          ))}
        </ul>

        <div className="hidden overflow-x-auto md:block">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Việc</th>
                <th className="px-4 py-3">Mô tả</th>
                <th className="px-4 py-3 text-center">Nhân viên</th>
                <th className="px-4 py-3 text-center">Quản lý</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PERMISSIONS_MATRIX.map((row) => (
                <tr key={row.feature} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{row.feature}</td>
                  <td className="max-w-md px-4 py-3.5 text-slate-600">{row.description}</td>
                  <td className="px-4 py-3.5 text-center">
                    <Mark ok={row.sale} />
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    <Mark ok={row.manager} />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      {/* Modal Thêm nhân sự mới */}
      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-xl">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="text-lg font-bold text-slate-900">Thêm tài khoản nhân sự</h3>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                aria-label="Đóng"
                className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100 hover:text-slate-700 sm:h-9 sm:w-9"
              >
                <Icon name="close" />
              </button>
            </div>

            <form onSubmit={handleCreateUser} className="mt-4 space-y-4">
              {formError && (
                <div className="rounded-lg bg-red-50 p-3 text-xs font-medium text-red-700 ring-1 ring-red-200">
                  {formError}
                </div>
              )}

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Họ và tên</label>
                <input
                  type="text"
                  required
                  placeholder="Ví dụ: Trần Văn Nam"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">Email đăng nhập</label>
                <input
                  type="email"
                  required
                  placeholder="namtran@example.com"
                  value={form.email}
                  onChange={(e) => setForm({ ...form, email: e.target.value })}
                  className={INPUT}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Mật khẩu khởi tạo (tối thiểu 6 ký tự)
                </label>
                <input
                  type="password"
                  required
                  placeholder="••••••••"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  className={INPUT}
                />
              </div>

              <div>
                <label className="block text-xs font-semibold uppercase text-slate-500 mb-1">
                  Vai trò phân quyền (Role)
                </label>
                <select
                  value={form.role}
                  onChange={(e) => setForm({ ...form, role: e.target.value as Role })}
                  className={INPUT}
                >
                  <option value="SALE">Nhân viên sale (SALE) - Xử lý lead, xem lịch, tạo cọc</option>
                  <option value="MANAGER">Quản lý (MANAGER) - Toàn quyền duyệt cọc, xem báo cáo, quản lý nhà</option>
                </select>
              </div>

              <div className="mt-6 flex justify-end gap-3 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  className="rounded-lg px-4 py-2 text-sm font-medium text-slate-600 hover:bg-slate-100"
                >
                  Hủy
                </button>
                <button
                  type="submit"
                  disabled={saving}
                  className="rounded-lg bg-brand-600 px-5 py-2 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-60"
                >
                  {saving ? "Đang lưu..." : "Tạo tài khoản"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

function RoleBadge({ role }: { role: Role }) {
  return (
    <span
      className={`inline-flex shrink-0 items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ring-1 ${
        role === "MANAGER" ? "bg-purple-50 text-purple-700 ring-purple-200" : "bg-blue-50 text-blue-700 ring-blue-200"
      }`}
    >
      {role === "MANAGER" ? "Quản lý" : "Nhân viên"}
    </span>
  );
}

// Dấu có / không có quyền trong bảng (máy tính)
function Mark({ ok }: { ok: boolean }) {
  return ok ? (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-emerald-100 text-emerald-700" aria-label="Có quyền">
      <Icon name="check" className="h-4 w-4" />
    </span>
  ) : (
    <span className="inline-flex h-7 w-7 items-center justify-center rounded-full bg-slate-100 text-slate-500" aria-label="Không có quyền">
      <Icon name="close" className="h-3.5 w-3.5" />
    </span>
  );
}

// Nhãn vai trò có / không có quyền (thẻ trên điện thoại): có chữ, không chỉ dựa vào màu
function Allowed({ ok, label }: { ok: boolean; label: string }) {
  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-1 ring-1 ${
        ok ? "bg-emerald-50 text-emerald-700 ring-emerald-200" : "bg-slate-50 text-slate-500 ring-slate-200 line-through"
      }`}
    >
      <Icon name={ok ? "check" : "close"} className="h-3.5 w-3.5" />
      {label}
    </span>
  );
}
