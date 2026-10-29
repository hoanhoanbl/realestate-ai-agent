"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { login } from "@/lib/api";
import { Alert, Button, Field, Icon, INPUT } from "@/components/ui";
import { saveSession, useSession } from "@/lib/auth";

const FEATURES = [
  "AI chấm điểm khách ngay khi họ đặt lịch",
  "Duyệt lịch, đổi giờ và nhắc khách tự động qua email, Telegram",
  "Hợp đồng đặt cọc soạn sẵn, khách ký online",
];

export default function LoginPage() {
  const router = useRouter();
  const session = useSession();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Đã đăng nhập rồi thì vào thẳng trang tổng quan
  useEffect(() => {
    if (session) router.replace("/admin");
  }, [session, router]);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const result = await login(email.trim(), password);
      saveSession({ token: result.accessToken, user: result.user });
      router.replace("/admin");
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Đăng nhập thất bại.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="grid w-full flex-1 lg:grid-cols-2">
      <div className="relative hidden overflow-hidden bg-gradient-to-br from-brand-700 via-brand-600 to-indigo-700 p-12 text-white lg:flex lg:flex-col lg:justify-between">
        <div aria-hidden className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-white/10" />
        <div aria-hidden className="absolute -bottom-32 -left-16 h-80 w-80 rounded-full bg-white/5" />
        <p className="relative flex items-center gap-2 text-lg font-bold">
          <span className="flex h-9 w-9 items-center justify-center rounded-lg bg-white/15">
            <Icon name="home" className="h-5 w-5" />
          </span>
          RealEstate AI
        </p>
        <div className="relative">
          <h2 className="text-3xl font-bold leading-tight">Quản lý khách và lịch xem nhà, có AI hỗ trợ từng bước.</h2>
          <ul className="mt-8 space-y-4 text-blue-100">
            {FEATURES.map((f) => (
              <li key={f} className="flex items-start gap-3">
                <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-white/15 text-white">
                  <Icon name="check" className="h-4 w-4" />
                </span>
                {f}
              </li>
            ))}
          </ul>
        </div>
        <p className="relative text-sm text-blue-200">Dành cho nhân viên kinh doanh và quản lý.</p>
      </div>

      <div className="flex items-center justify-center px-4 py-12 sm:px-6">
        <form onSubmit={handleSubmit} className="w-full max-w-sm space-y-5">
          <div>
            <p className="mb-6 flex items-center gap-2 font-bold text-slate-900 lg:hidden">
              <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand-600 text-white">
                <Icon name="home" className="h-4 w-4" />
              </span>
              RealEstate <span className="-ml-1 text-brand-600">AI</span>
            </p>
            <h1 className="text-2xl font-bold tracking-tight text-slate-900">Đăng nhập quản trị</h1>
            <p className="mt-1 text-sm text-slate-500">Dùng email công ty đã được quản lý cấp.</p>
          </div>
          <Field id="email" label="Email">
            <input
              id="email"
              type="email"
              className={INPUT}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              required
            />
          </Field>
          <Field id="password" label="Mật khẩu">
            <input
              id="password"
              type="password"
              className={INPUT}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
              required
            />
          </Field>
          {error && <Alert>{error}</Alert>}
          <Button type="submit" size="lg" disabled={submitting} className="w-full">
            {submitting ? "Đang đăng nhập..." : "Đăng nhập"}
          </Button>
        </form>
      </div>
    </div>
  );
}
