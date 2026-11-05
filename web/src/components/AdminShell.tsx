"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { Icon, type IconName } from "@/components/ui";
import { clearSession, useSession, type Role } from "@/lib/auth";

interface NavLink {
  href: string;
  label: string;
  icon: IconName;
  exact?: boolean;
  roles?: Role[];
}

const GROUPS: { title: string; links: NavLink[] }[] = [
  {
    title: "Vận hành",
    links: [
      { href: "/admin", label: "Tổng quan", icon: "dashboard", exact: true },
      { href: "/admin/leads", label: "Khách hàng", icon: "users" },
      { href: "/admin/lich-xem", label: "Lịch xem", icon: "calendar" },
      { href: "/admin/hop-dong", label: "Hợp đồng", icon: "contract" },
    ],
  },
  {
    title: "Quản lý",
    links: [
      { href: "/admin/bao-cao", label: "Báo cáo", icon: "chart", roles: ["MANAGER"] },
      { href: "/admin/nha", label: "Quản lý nhà", icon: "home", roles: ["MANAGER"] },
      { href: "/admin/tai-khoan", label: "Phân quyền", icon: "shield", roles: ["MANAGER"] },
    ],
  },
];

const ROLE_LABEL: Record<Role, string> = { MANAGER: "Quản lý", SALE: "Nhân viên" };

function isActive(link: NavLink, pathname: string): boolean {
  return link.exact ? pathname === link.href : pathname === link.href || pathname.startsWith(`${link.href}/`);
}

function Brand() {
  return (
    <Link href="/admin" className="flex min-h-11 items-center gap-2">
      <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
        <Icon name="home" className="h-4 w-4" />
      </span>
      <span className="font-bold text-slate-900">
        RealEstate <span className="text-brand-600">AI</span>
      </span>
    </Link>
  );
}

function initials(name: string): string {
  const parts = name.trim().split(/\s+/);
  return ((parts[0]?.[0] ?? "") + (parts.length > 1 ? parts[parts.length - 1][0] : "")).toUpperCase();
}

// Khung của khu quản trị: kiểm tra đăng nhập, menu dọc bên trái (điện thoại: menu trượt), thanh trên cùng
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const [drawerOpen, setDrawerOpen] = useState(false);
  const isLogin = pathname === "/admin/login";
  // Trang in hợp đồng: không có menu, chỉ còn nội dung khổ A4
  const isPrint = pathname.endsWith("/in");

  useEffect(() => {
    if (session === null && !isLogin) router.replace("/admin/login");
  }, [session, isLogin, router]);

  // Menu trượt đang mở thì khoá cuộn trang phía sau, bấm Esc để đóng
  useEffect(() => {
    if (!drawerOpen) return;
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setDrawerOpen(false);
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = "";
      window.removeEventListener("keydown", onKey);
    };
  }, [drawerOpen]);

  if (isLogin) return <main className="flex flex-1">{children}</main>;
  if (!session) return <p className="p-8 text-slate-500">Đang kiểm tra đăng nhập...</p>;
  if (isPrint) return <main className="flex-1 bg-slate-100 print:bg-white">{children}</main>;

  const role = session.user.role;
  const groups = GROUPS.map((g) => ({ ...g, links: g.links.filter((l) => !l.roles || l.roles.includes(role)) })).filter(
    (g) => g.links.length > 0,
  );
  const current = groups.flatMap((g) => g.links).find((l) => isActive(l, pathname));

  function logout() {
    clearSession();
    router.replace("/admin/login");
  }

  const nav = (
    <nav aria-label="Menu quản trị" className="flex-1 space-y-6 overflow-y-auto px-3 py-4">
      {groups.map((group) => (
        <div key={group.title}>
          <p className="px-3 text-xs font-semibold uppercase tracking-wider text-slate-400">{group.title}</p>
          <ul className="mt-2 space-y-1">
            {group.links.map((link) => {
              const active = isActive(link, pathname);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    onClick={() => setDrawerOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-11 items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition lg:min-h-0 ${
                      active ? "bg-brand-50 text-brand-700" : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
                    }`}
                  >
                    <Icon name={link.icon} className={`h-5 w-5 ${active ? "text-brand-600" : "text-slate-400"}`} />
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </div>
      ))}
    </nav>
  );

  const userBox = (
    <div className="border-t border-slate-200 p-3">
      <div className="flex items-center gap-3 rounded-lg px-2 py-2">
        <span
          className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-sm font-bold ${
            role === "MANAGER" ? "bg-purple-100 text-purple-700" : "bg-brand-100 text-brand-700"
          }`}
        >
          {initials(session.user.name)}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold text-slate-900">{session.user.name}</p>
          <p className="truncate text-xs text-slate-500">{ROLE_LABEL[role]}</p>
        </div>
        <button
          type="button"
          onClick={logout}
          title="Đăng xuất"
          aria-label="Đăng xuất"
          className="rounded-md p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900"
        >
          <Icon name="logout" />
        </button>
      </div>
    </div>
  );

  return (
    <div className="flex min-h-full flex-1">
      {/* Máy tính: menu dọc cố định */}
      <aside className="fixed inset-y-0 left-0 z-40 hidden w-64 flex-col border-r border-slate-200 bg-white lg:flex">
        <div className="flex h-16 items-center border-b border-slate-200 px-5">
          <Brand />
        </div>
        {nav}
        {userBox}
      </aside>

      {/* Điện thoại: menu trượt từ trái */}
      {drawerOpen && (
        <div className="fixed inset-0 z-50 lg:hidden" role="dialog" aria-modal="true" aria-label="Menu">
          <button type="button" aria-label="Đóng menu" className="absolute inset-0 bg-slate-900/40" onClick={() => setDrawerOpen(false)} />
          <aside className="absolute inset-y-0 left-0 flex w-72 max-w-[85%] flex-col bg-white shadow-xl">
            <div className="flex h-16 items-center justify-between border-b border-slate-200 px-5">
              <Brand />
              <button type="button" aria-label="Đóng menu" onClick={() => setDrawerOpen(false)} className="flex h-11 w-11 items-center justify-center rounded-lg text-slate-500 hover:bg-slate-100">
                <Icon name="close" />
              </button>
            </div>
            {nav}
            {userBox}
          </aside>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-col lg:pl-64">
        <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-slate-200 bg-white/90 px-4 backdrop-blur sm:px-6 lg:px-8">
          <button
            type="button"
            aria-label="Mở menu"
            onClick={() => setDrawerOpen(true)}
            className="-ml-1 flex h-11 w-11 items-center justify-center rounded-lg text-slate-600 hover:bg-slate-100 lg:hidden"
          >
            <Icon name="menu" />
          </button>
          <div className="lg:hidden">
            <Brand />
          </div>
          <p className="hidden text-sm text-slate-500 lg:block">
            Quản trị <span className="mx-1 text-slate-300">/</span>
            <span className="font-medium text-slate-900">{current?.label ?? "Chi tiết"}</span>
          </p>
          <div className="ml-auto flex items-center gap-2">
            <Link href="/" target="_blank" className="hidden items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-slate-600 hover:bg-slate-100 sm:inline-flex">
              Xem trang khách <Icon name="externalLink" className="h-4 w-4" />
            </Link>
          </div>
        </header>
        <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 sm:px-6 lg:px-8 lg:py-8">{children}</main>
      </div>
    </div>
  );
}
