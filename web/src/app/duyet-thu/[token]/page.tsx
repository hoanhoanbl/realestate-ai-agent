"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import { Alert, Button, CARD, Field, Icon, INPUT, Skeleton } from "@/components/ui";
import {
  ApiError,
  confirmLadderLink,
  getLadderLink,
  LADDER_EMAIL_MAX_LENGTH,
  type LadderDecision,
  type LadderLinkInfo,
  type LadderLinkRefusal,
  type LadderSuggestionAction,
} from "@/lib/api";

// Sale mở từ lời nhắc của luồng 9 (Telegram, email). Không cần đăng nhập, token trong link có chữ ký.
// Mở trang chỉ xem; thư chỉ đi khi bấm "Gửi cho khách", để trình quét link của email không tự gửi.
// Không hiện số điện thoại hay email của khách (api-contract.md mục 3.10).
export default function LadderLinkPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-64 max-w-md" />}>
      <LadderLinkContent />
    </Suspense>
  );
}

const ACTION_LABELS: Record<LadderSuggestionAction, string> = {
  CALL: "Gọi điện cho khách",
  SEND_EMAIL: "Gửi thư cho khách",
  OFFER_VIEWING: "Mời khách xem căn khác",
  WAIT: "Chờ thêm, chưa cần làm gì",
};

const REFUSAL_TEXT: Record<LadderLinkRefusal, string> = {
  NO_CONSENT: "Khách chưa đồng ý nhận tin nên hệ thống không gửi thư được. Hãy liên hệ trực tiếp với khách.",
  NO_EMAIL: "Khách không có email nên hệ thống không gửi thư được. Hãy liên hệ trực tiếp với khách.",
};

function Shell({ children }: { children: React.ReactNode }) {
  return (
    <main className="min-h-full flex-1 bg-slate-100 px-4 py-8">
      <div className="mx-auto max-w-md">{children}</div>
    </main>
  );
}

function AdminLink() {
  return (
    <Link href="/admin/leads" className="inline-flex min-h-11 items-center font-medium text-brand-600 hover:underline">
      Mở trang quản trị
    </Link>
  );
}

function Notice({ tone, title, children }: { tone: "success" | "neutral"; title: string; children: React.ReactNode }) {
  const style =
    tone === "success"
      ? "border-emerald-200 bg-emerald-50 text-emerald-900"
      : "border-slate-200 bg-white text-slate-800";
  return (
    <div className={`rounded-xl border p-6 ${style}`} role="status">
      <h1 className="text-xl font-bold">{title}</h1>
      <div className="mt-2 text-sm">{children}</div>
      <div className="mt-4">
        <AdminLink />
      </div>
    </div>
  );
}

function kindTitle(info: LadderLinkInfo): string {
  if (info.kind === "REACH") return `Nhắc liên hệ khách, ngày ${info.step ?? ""}`.trim();
  return "Khách im lặng, cần chăm lại";
}

function LadderLinkContent() {
  const { token } = useParams<{ token: string }>();
  const [info, setInfo] = useState<LadderLinkInfo | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [text, setText] = useState("");
  const [busy, setBusy] = useState<LadderDecision | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState<{ decision: LadderDecision; already: boolean } | null>(null);

  const load = useCallback(
    () =>
      getLadderLink(token).then(
        (data) => {
          setInfo(data);
          return data;
        },
        (e: unknown) => {
          if (e instanceof ApiError && e.status === 404) setNotFound(true);
          else setLoadError(e instanceof Error ? e.message : "Không tải được trang này.");
          return null;
        },
      ),
    [token],
  );

  useEffect(() => {
    let cancelled = false;
    getLadderLink(token)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        setText(data.suggestion.emailDraft ?? "");
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

  async function decide(decision: LadderDecision) {
    setBusy(decision);
    setError(null);
    try {
      const result = await confirmLadderLink(token, decision, decision === "SEND" ? text.trim() : undefined);
      setDone({ decision: result.decision, already: result.already === true });
    } catch (e: unknown) {
      if (e instanceof ApiError && e.status === 400) {
        // Trạng thái link đã đổi (lead đóng, có nhắc mới, khách rút đồng ý): tải lại để trang hiện đúng trạng thái.
        const fresh = await load();
        if (fresh && fresh.state === "OPEN" && fresh.canSend) setError(e.message);
      } else if (e instanceof ApiError && e.status === 502) {
        setError("Chưa gửi được, thử lại sau.");
      } else {
        setError(e instanceof Error ? e.message : "Thao tác thất bại.");
      }
    } finally {
      setBusy(null);
    }
  }

  if (notFound) return <Shell><Alert tone="warning">Liên kết không hợp lệ.</Alert></Shell>;
  if (loadError) return <Shell><Alert>{loadError}</Alert></Shell>;
  if (!info) return <Shell><Skeleton className="h-64" /></Shell>;

  if (done) {
    if (done.already) {
      return (
        <Shell>
          <Notice tone="neutral" title="Đã xử lý trước đó">
            <p>Lời nhắc này đã được gửi hoặc bỏ qua. Không có thư nào gửi thêm.</p>
          </Notice>
        </Shell>
      );
    }
    return (
      <Shell>
        <Notice tone="success" title={done.decision === "SEND" ? "Đã gửi" : "Đã bỏ qua"}>
          <p>
            {done.decision === "SEND"
              ? "Thư đang được gửi tới khách. Liên kết này hết hiệu lực."
              : "Không gửi thư cho khách. Liên kết này hết hiệu lực."}
          </p>
        </Notice>
      </Shell>
    );
  }

  if (info.state === "HANDLED") {
    return (
      <Shell>
        <Notice tone="neutral" title="Đã xử lý">
          <p>Lời nhắc này đã được gửi hoặc bỏ qua trước đó.</p>
        </Notice>
      </Shell>
    );
  }
  if (info.state === "EXPIRED") {
    return (
      <Shell>
        <Notice tone="neutral" title="Liên kết đã hết hiệu lực">
          <p>Khách này đã được đóng hoặc đã có lời nhắc mới hơn. Hãy mở lời nhắc mới nhất.</p>
        </Notice>
      </Shell>
    );
  }

  const trimmed = text.trim();
  const tooLong = text.length > LADDER_EMAIL_MAX_LENGTH;
  const invalid = trimmed.length === 0 || tooLong;
  const { suggestion } = info;

  return (
    <Shell>
      <div className={`${CARD} overflow-hidden`}>
        <div className="flex items-center gap-3 bg-brand-600 px-5 py-4 text-white">
          <Icon name="mail" className="h-6 w-6 shrink-0" />
          <div className="min-w-0">
            <p className="text-xs uppercase tracking-wide text-brand-100">Duyệt thư cho khách</p>
            <p className="text-lg font-bold">{kindTitle(info)}</p>
          </div>
        </div>

        <div className="space-y-4 p-5 text-sm text-slate-800">
          <div className="space-y-3">
            <p>
              <span className="block text-xs text-slate-500">Khách</span>
              <b className="text-base [overflow-wrap:anywhere]">{info.leadName}</b>
              <span className="ml-2 align-middle">
                <LeadStatusBadge status={info.leadStatus} />
              </span>
            </p>
            {info.assigneeName && (
              <p>
                <span className="block text-xs text-slate-500">Sale phụ trách</span>
                <b className="[overflow-wrap:anywhere]">{info.assigneeName}</b>
              </p>
            )}
            {info.propertyName && (
              <p>
                <span className="block text-xs text-slate-500">Căn nhà xem gần nhất</span>
                <b className="[overflow-wrap:anywhere]">{info.propertyName}</b>
              </p>
            )}
          </div>

          <div className="rounded-lg bg-slate-50 p-3 ring-1 ring-slate-200">
            <p className="flex items-center gap-2 text-xs text-slate-500">
              <Icon name="sparkles" className="h-4 w-4" />
              AI gợi ý
            </p>
            <p className="mt-1 text-base font-semibold">{ACTION_LABELS[suggestion.action]}</p>
            <p className="mt-1 text-slate-600 [overflow-wrap:anywhere]">{suggestion.reason}</p>
          </div>

          {info.refusal && <Alert tone="warning">{REFUSAL_TEXT[info.refusal]}</Alert>}

          {info.canSend && (
            <Field
              id="ladder-email"
              label="Nội dung thư gửi khách"
              hint={
                suggestion.emailDraft === null
                  ? "AI chưa soạn được nháp. Bạn có thể tự viết thư, hoặc bấm Bỏ qua."
                  : "Bạn có thể sửa lại trước khi gửi. Chỉ nhập chữ thường, không dùng HTML."
              }
            >
              <textarea
                id="ladder-email"
                className={`${INPUT} min-h-48 resize-y leading-relaxed`}
                value={text}
                onChange={(e) => setText(e.target.value)}
                disabled={busy !== null}
              />
              <p className={`mt-1 text-right text-xs ${tooLong ? "font-medium text-red-700" : "text-slate-500"}`}>
                {text.length}/{LADDER_EMAIL_MAX_LENGTH}
              </p>
            </Field>
          )}

          {error && <Alert>{error}</Alert>}

          <div className="space-y-2">
            {info.canSend && (
              <Button onClick={() => decide("SEND")} disabled={busy !== null || invalid} size="lg" className="w-full">
                {busy === "SEND" ? "Đang gửi…" : "Gửi cho khách"}
              </Button>
            )}
            <Button
              variant="secondary"
              onClick={() => decide("SKIP")}
              disabled={busy !== null}
              size={info.canSend ? "md" : "lg"}
              className="w-full"
            >
              {busy === "SKIP" ? "Đang xử lý…" : "Bỏ qua"}
            </Button>
          </div>

          <AdminLink />
        </div>
      </div>
    </Shell>
  );
}
