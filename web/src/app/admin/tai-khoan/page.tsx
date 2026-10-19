"use client";

import { useCallback, useEffect, useState } from "react";
import { createUser, formatDateTime, getUsers, type UserAccount } from "@/lib/api";
import { useSession, type Role } from "@/lib/auth";

const INPUT =
  "w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 outline-none focus:border-blue-500 focus:ring-2 focus:ring-blue-100";

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

const PERMISSIONS_MATRIX: PermissionRow[] = [
  {
    feature: "Đăng nhập & Xác thực JWT",
    description: "Đăng nhập hệ thống bằng email và mật khẩu, cấp token 8 giờ",
    sale: true,
    manager: true,
  },
  {
    feature: "Xem & Lọc Khách hàng",
    description: "Xem danh sách lead, chi tiết nhu cầu, điểm AI (HOT/WARM/COLD)",
    sale: true,
    manager: true,
  },
  {
    feature: "Duyệt lịch & Đổi giờ xem",
    description: "Bấm Duyệt lịch xem nhà (kích hoạt n8n) hoặc dời lịch hẹn",
    sale: true,
    manager: true,
  },
  {
    feature: "Cập nhật kết quả buổi xem",
    description: "Đánh dấu khách Đã xem nhà (VIEWED) hoặc Mất khách (LOST)",
    sale: true,
    manager: true,
  },
  {
    feature: "Tạo hợp đồng đặt cọc",
    description: "Soạn hợp đồng cọc cho khách đã xem nhà (chuyển sang DEPOSIT)",
    sale: true,
    manager: true,
  },
  {
    feature: "Phê duyệt / Từ chối Hợp đồng",
    description: "Kiểm tra hợp đồng do AI rà soát, duyệt gửi khách ký hoặc từ chối",
    sale: false,
    manager: true,
  },
  {
    feature: "Xem Báo cáo kinh doanh (AI)",
    description: "Xem số liệu phễu, phân tích AI và yêu cầu n8n tạo báo cáo tuần",
    sale: false,
    manager: true,
  },
  {
    feature: "Quản lý Bất động sản",
    description: "Thêm căn mới, cập nhật giá/diện tích, ẩn/xoá mềm căn nhà",
    sale: false,
    manager: true,
  },
  {
    feature: "Quản trị Tài khoản & Phân quyền",
    description: "Xem danh sách tài khoản, tạo nhân sự mới, phân vai trò RBAC",
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
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-slate-200 pb-5">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Quản trị Tài khoản & Phân quyền (RBAC)</h1>
          <p className="mt-1 text-sm text-slate-500">
            Quản lý nhân sự, phân quyền vai trò và đối soát ma trận quyền hạn hệ thống.
          </p>
        </div>
        <button
          type="button"
          onClick={() => {
            setShowModal(true);
            setFormError(null);
          }}
          className="rounded-lg bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-blue-700"
        >
          + Thêm nhân sự mới
        </button>
      </div>

      {successMsg && (
        <div className="rounded-lg bg-emerald-50 p-4 text-sm font-medium text-emerald-800 ring-1 ring-emerald-200">
          {successMsg}
        </div>
      )}

      {error && (
        <div className="rounded-lg bg-red-50 p-4 text-sm font-medium text-red-800 ring-1 ring-red-200">{error}</div>
      )}

      {/* Danh sách tài khoản người dùng */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Danh sách Tài khoản Hệ thống</h2>
            <p className="text-xs text-slate-500">Dữ liệu từ bảng `users` trong PostgreSQL</p>
          </div>
          <span className="rounded-md bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-600">
            Tổng cộng: {users ? users.length : "..."} tài khoản
          </span>
        </div>

        {!users ? (
          <p className="py-6 text-center text-sm text-slate-500">Đang tải danh sách tài khoản...</p>
        ) : users.length === 0 ? (
          <p className="py-6 text-center text-sm text-slate-500">Chưa có tài khoản nào.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-500">
                <tr>
                  <th className="px-4 py-3">ID</th>
                  <th className="px-4 py-3">Họ và tên</th>
                  <th className="px-4 py-3">Email đăng nhập</th>
                  <th className="px-4 py-3">Vai trò (Role)</th>
                  <th className="px-4 py-3">Thông báo App Mobile</th>
                  <th className="px-4 py-3">Ngày tạo</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-slate-700">
                {users.map((u) => (
                  <tr key={u.id} className="hover:bg-slate-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-slate-400">#{u.id}</td>
                    <td className="px-4 py-3 font-medium text-slate-900">{u.name}</td>
                    <td className="px-4 py-3 font-mono text-xs text-slate-600">{u.email}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
                          u.role === "MANAGER"
                            ? "bg-purple-100 text-purple-700 ring-1 ring-purple-300"
                            : "bg-blue-100 text-blue-700 ring-1 ring-blue-300"
                        }`}
                      >
                        {u.role === "MANAGER" ? "Quản lý (MANAGER)" : "Nhân viên (SALE)"}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-xs">
                      {u.pushToken ? (
                        <span className="inline-flex items-center text-emerald-600 font-medium">
                          <span className="mr-1.5 h-2 w-2 rounded-full bg-emerald-500"></span>
                          Đã kết nối Expo Push
                        </span>
                      ) : (
                        <span className="text-slate-400">Chưa cài app</span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-xs text-slate-500">{formatDateTime(u.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Ma trận Phân quyền RBAC Matrix */}
      <section className="rounded-xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-4">
          <h2 className="text-lg font-bold text-slate-900">Ma trận Phân quyền (Role-Based Access Control)</h2>
          <p className="text-sm text-slate-500">
            Quy định giới hạn quyền truy cập nghiệp vụ giữa hai vai trò chính trong hệ thống.
          </p>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase text-slate-600">
              <tr>
                <th className="px-4 py-3">Tính năng / Nghiệp vụ</th>
                <th className="px-4 py-3">Mô tả hành vi</th>
                <th className="px-4 py-3 text-center">
                  <span className="rounded bg-blue-100 px-2 py-1 text-blue-700 font-bold">Nhân viên sale (SALE)</span>
                </th>
                <th className="px-4 py-3 text-center">
                  <span className="rounded bg-purple-100 px-2 py-1 text-purple-700 font-bold">Quản lý (MANAGER)</span>
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 text-slate-700">
              {PERMISSIONS_MATRIX.map((row, idx) => (
                <tr key={idx} className="hover:bg-slate-50/60">
                  <td className="px-4 py-3.5 font-semibold text-slate-900">{row.feature}</td>
                  <td className="px-4 py-3.5 text-xs text-slate-500 max-w-md">{row.description}</td>
                  <td className="px-4 py-3.5 text-center">
                    {row.sale ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold text-sm">
                        ✕
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {row.manager ? (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 font-bold text-sm">
                        ✓
                      </span>
                    ) : (
                      <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-slate-100 text-slate-400 font-bold text-sm">
                        ✕
                      </span>
                    )}
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
                className="rounded-lg p-1 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
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
                  className="rounded-lg bg-blue-600 px-5 py-2 text-sm font-semibold text-white hover:bg-blue-700 disabled:opacity-60"
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
