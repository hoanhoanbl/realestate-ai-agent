"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";
import { clearSession, useSession, type Role } from "@/lib/auth";

interface NavLink {
  href: string;
  label: string;
  exact?: boolean;
  roles?: Role[];
}

const LINKS: NavLink[] = [
  { href: "/admin", label: "Tổng quan", exact: true },
  { href: "/admin/leads", label: "Khách hàng" },
  { href: "/admin/lich-xem", label: "Lịch xem" },
  { href: "/admin/nha", label: "Quản lý nhà", roles: ["MANAGER"] },
];

const ROLE_LABEL: Record<Role, string> = { MANAGER: "Quản lý", SALE: "Nhân viên" };

// Khung của khu quản trị: kiểm tra đăng nhập, thanh điều hướng, nút đăng xuất
export default function AdminShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const session = useSession();
  const isLogin = pathname === "/admin/login";

  useEffect(() => {
    if (session === null && !isLogin) router.replace("/admin/login");
  }, [session, isLogin, router]);

  if (isLogin) return <main className="mx-auto w-full max-w-md flex-1 px-4 py-16">{children}</main>;
  if (!session) return <p className="p-8 text-slate-500">Đang kiểm tra đăng nhập...</p>;

  const links = LINKS.filter((l) => !l.roles || l.roles.includes(session.user.role));

  return (
    <>
      <header className="sticky top-0 z-50 border-b border-slate-200 bg-white shadow-sm">
        <nav className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-2 px-4 py-3 sm:px-6 lg:px-8">
          <Link href="/admin" className="text-lg font-bold text-slate-900">
            RealEstate <span className="text-blue-600">AI</span>{" "}
            <span className="ml-1 rounded bg-slate-100 px-1.5 py-0.5 text-xs font-medium text-slate-500">
              Quản trị
            </span>
          </Link>
          <ul className="flex flex-wrap gap-1 text-sm">
            {links.map((link) => {
              const active = link.exact
                ? pathname === link.href
                : pathname === link.href || pathname.startsWith(`${link.href}/`);
              return (
                <li key={link.href}>
                  <Link
                    href={link.href}
                    aria-current={active ? "page" : undefined}
                    className={`rounded-md px-3 py-2 font-medium ${
                      active ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                    }`}
                  >
                    {link.label}
                  </Link>
                </li>
              );
            })}
          </ul>
          <div className="flex items-center gap-3 text-sm">
            <span className="text-slate-600">
              {session.user.name}{" "}
              <span className="text-xs text-slate-400">({ROLE_LABEL[session.user.role]})</span>
            </span>
            <button
              type="button"
              onClick={() => {
                clearSession();
                router.replace("/admin/login");
              }}
              className="rounded-md px-3 py-1.5 font-medium text-slate-600 ring-1 ring-slate-300 hover:bg-slate-100"
            >
              Đăng xuất
            </button>
          </div>
        </nav>
      </header>
      <main className="mx-auto w-full max-w-7xl flex-1 px-4 py-8 sm:px-6 lg:px-8">{children}</main>
    </>
  );
}
