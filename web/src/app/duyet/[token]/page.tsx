"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import { Alert, Button, CARD, Icon, Skeleton } from "@/components/ui";
import { ApiError, confirmStaffLink, formatDateTime, getStaffLink, type StaffLinkInfo } from "@/lib/api";

// Nhân viên mở từ nút Duyệt / Đổi giờ trong thông báo (email, Telegram). Không cần đăng nhập, token trong link có chữ ký.
// Mở trang chỉ xem tóm tắt; lịch chỉ đổi khi bấm nút xác nhận để trình quét link của email không tự duyệt.
export default function StaffLinkPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-64 max-w-md" />}>
      <StaffLinkContent />
    </Suspense>
  );
}

const TEXT = {
  approve: {
    title: "Duyệt lịch xem nhà",
    button: "Duyệt lịch",
    hint: "Khách sẽ nhận thư chốt lịch kèm link quản lý lịch.",
    done: "Đã duyệt. Khách đang nhận thư chốt lịch.",
  },
  reschedule: {
    title: "Đổi giờ xem nhà",
    button: "Báo khách cần hẹn lại giờ",
    hint: "Khách sẽ nhận thư báo cần hẹn lại. Bạn đặt giờ mới trên trang quản trị rồi duyệt lại.",
    done: "Đã báo khách cần hẹn lại giờ. Hãy đặt giờ mới trên trang quản trị.",
  },
} as const;

function StaffLinkContent() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<StaffLinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ already: boolean } | null>(null);

  useEffect(() => {
    let cancelled = false;
    getStaffLink(token)
      .then((data) => {
        if (!cancelled) setInfo(data);
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        if (e instanceof ApiError && e.status === 404) setNotFound(true);
        else setLoadError(e instanceof Error ? e.message : "Không tải được trang này.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  async function confirm() {
    setBusy(true);
    setError(null);
    try {
      const result = await confirmStaffLink(token);
      setDone({ already: result.already === true });
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Thao tác thất bại.");
    } finally {
      setBusy(false);
    }
  }

  const shell = (children: React.ReactNode) => (
    <main className="min-h-full flex-1 bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">{children}</div>
    </main>
  );

  if (notFound) return shell(<Alert tone="warning">Liên kết không hợp lệ.</Alert>);
  if (loadError) return shell(<Alert>{loadError}</Alert>);
  if (!info) return shell(<Skeleton className="h-64" />);

  const text = TEXT[info.action];

  if (done) {
    return shell(
      <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-6" role="status">
        <h1 className="text-xl font-bold text-emerald-800">{done.already ? "Đã xử lý trước đó" : "Xong"}</h1>
        <p className="mt-2 text-emerald-900">
          {done.already ? "Yêu cầu này đã được gửi cho khách cách đây ít phút." : text.done}
        </p>
        <Link href="/admin/leads" className="mt-4 inline-flex min-h-11 items-center font-medium text-emerald-800 underline">
          Mở trang quản trị
        </Link>
      </div>,
    );
  }

  return shell(
    <div className={`${CARD} overflow-hidden`}>
      <div className="flex items-center gap-3 bg-brand-600 px-5 py-4 text-white">
        <Icon name="calendar" className="h-6 w-6 shrink-0" />
        <div className="min-w-0">
          <p className="text-xs uppercase tracking-wide text-brand-100">{text.title}</p>
          <p className="text-lg font-bold">{info.viewingTime ? formatDateTime(info.viewingTime) : "Chưa có giờ hẹn"}</p>
        </div>
      </div>
      <div className="space-y-3 p-5 text-sm text-slate-800">
        <p>
          <span className="block text-xs text-slate-500">Khách</span>
          <b className="text-base [overflow-wrap:anywhere]">{info.leadName}</b>
        </p>
        {info.propertyName && (
          <p>
            <span className="block text-xs text-slate-500">Căn nhà</span>
            <b className="text-base [overflow-wrap:anywhere]">{info.propertyName}</b>
            {info.propertyAddress && <span className="block text-slate-600 [overflow-wrap:anywhere]">{info.propertyAddress}</span>}
          </p>
        )}

        {info.canAct ? (
          <>
            <p className="text-slate-600">{text.hint}</p>
            {error && <Alert>{error}</Alert>}
            <Button onClick={confirm} disabled={busy} size="lg" className="w-full">
              {busy ? "Đang xử lý…" : text.button}
            </Button>
          </>
        ) : (
          <Alert tone="warning">{info.refusal ?? "Không thao tác được với liên kết này."}</Alert>
        )}
        <Link href="/admin/leads" className="inline-flex min-h-11 items-center text-brand-600 hover:underline">
          Mở trang quản trị
        </Link>
      </div>
    </div>,
  );
}
