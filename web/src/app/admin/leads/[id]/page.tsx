"use client";

import Link from "next/link";
import { BackLink, Icon } from "@/components/ui";
import { useParams } from "next/navigation";
import { Suspense, useEffect, useState, type ReactNode } from "react";
import ContactButtons from "@/components/ContactButtons";
import LeadActions from "@/components/LeadActions";
import LeadAssignmentPanel from "@/components/LeadAssignmentPanel";
import LeadChatHistory from "@/components/LeadChatHistory";
import LeadStatusBadge from "@/components/LeadStatusBadge";
import LevelBadge from "@/components/LevelBadge";
import MauticScoreCard from "@/components/MauticScoreCard";
import StatusBadge from "@/components/StatusBadge";
import ViewingHistory from "@/components/ViewingHistory";
import {
  ApiError,
  eventLabel,
  formatDateTime,
  formatVnd,
  getLead,
  getLeadEvents,
  getLeadFeedback,
  LOST_REASON_LABELS,
  PROPERTY_STATUS_LABELS,
  sourceLabel,
  VIEWING_STATUS_LABELS,
  type PropertyStatus,
  type Feedback,
  type LeadDetail,
  type LeadEvent,
} from "@/lib/api";

// Tự tải lại để khi nhân viên bấm Duyệt trong email thì dòng APPROVED hiện ngay
const POLL_MS = 5000;

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5">
      <h2 className="text-sm font-semibold uppercase text-slate-500">
        {title}
      </h2>
      <div className="mt-3 space-y-2 text-sm text-slate-800">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex gap-3">
      <span className="w-24 shrink-0 text-slate-500 sm:w-32">{label}</span>
      <span className="min-w-0 flex-1 [overflow-wrap:anywhere]">{children}</span>
    </div>
  );
}

function NotFound() {
  return (
    <section>
      <BackLink href="/admin/leads">Danh sách khách</BackLink>
      <p className="mt-6 rounded-lg bg-slate-50 p-4 text-slate-700 ring-1 ring-slate-200">
        Không tìm thấy khách.
      </p>
    </section>
  );
}

// useParams() cần nằm trong Suspense vì `id` chỉ biết lúc người dùng mở trang
export default function LeadDetailPage() {
  return (
    <Suspense fallback={<p className="text-slate-500">Đang tải...</p>}>
      <LeadDetailContent />
    </Suspense>
  );
}

function LeadDetailContent() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const invalidId = !Number.isInteger(id) || id <= 0;

  const [lead, setLead] = useState<LeadDetail | null>(null);
  const [events, setEvents] = useState<LeadEvent[]>([]);
  const [feedback, setFeedback] = useState<Feedback | null>(null);
  const [notFound, setNotFound] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<Date | null>(null);
  // tăng lên để tải lại ngay sau khi nhân viên bấm một nút
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (invalidId) return;
    let cancelled = false;

    function load() {
      Promise.all([getLead(id), getLeadEvents(id), getLeadFeedback(id)])
        .then(([leadData, eventData, feedbackData]) => {
          if (cancelled) return;
          setLead(leadData);
          setEvents(eventData);
          setFeedback(feedbackData);
          setError(null);
          setUpdatedAt(new Date());
        })
        .catch((e: unknown) => {
          if (cancelled) return;
          if (e instanceof ApiError && e.status === 404) {
            setNotFound(true);
            clearInterval(timer);
            return;
          }
          setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        });
    }

    const timer = setInterval(load, POLL_MS);
    load();
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, [id, invalidId, version]);

  if (invalidId || notFound) return <NotFound />;

  return (
    <section>
      <BackLink href="/admin/leads">Danh sách khách</BackLink>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200"
        >
          {error}
        </p>
      )}

      {lead === null && !error && (
        <p className="mt-6 text-slate-500">Đang tải...</p>
      )}

      {lead !== null && (
        <>
          <div className="mt-3 flex flex-wrap items-end justify-between gap-3">
            <div>
              <h1 className="text-2xl font-bold text-slate-900">{lead.name}</h1>
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <LeadStatusBadge status={lead.status} />
                <LevelBadge level={lead.level} />
                <StatusBadge status={lead.automationStatus} />
                {lead.status === "LOST" && lead.lostReason && (
                  <span className="text-xs text-rose-700">Lý do: {LOST_REASON_LABELS[lead.lostReason] ?? lead.lostReason}</span>
                )}
              </div>
            </div>
            {updatedAt && (
              <p className="text-xs text-slate-500">
                Cập nhật lúc {updatedAt.toLocaleTimeString("vi-VN")} (tự tải lại
                mỗi 5 giây)
              </p>
            )}
          </div>

          <LeadActions lead={lead} onChanged={() => setVersion((v) => v + 1)} />
          <LeadAssignmentPanel key={lead.id} lead={lead} onChanged={() => setVersion((v) => v + 1)} />

          <div className="mt-5">
            <MauticScoreCard lead={lead} />
          </div>

          <div className="mt-5 grid gap-4 md:grid-cols-2 [&>*]:min-w-0">
            <Card title="Thông tin khách">
              <ContactButtons phone={lead.phone} email={lead.email} />
              <Field label="Số điện thoại">{lead.phone}</Field>
              <Field label="Email">{lead.email}</Field>
              <Field label="Nguồn khách">{sourceLabel(lead.source)}</Field>
              <Field label="Ngân sách">{formatVnd(lead.budget)}</Field>
              <Field label="Nhu cầu">{lead.needs ?? "-"}</Field>
              <Field label="Tạo lúc">{formatDateTime(lead.createdAt)}</Field>
            </Card>

            <Card title="Căn nhà và lịch xem">
              {lead.property ? (
                <>
                  <Field label="Căn nhà">{lead.property.name}</Field>
                  <Field label="Địa chỉ">{lead.property.address}</Field>
                  <Field label="Giá">{formatVnd(lead.property.price)}</Field>
                  {lead.property.status !== "AVAILABLE" && (
                    <Field label="Trạng thái căn">
                      {PROPERTY_STATUS_LABELS[lead.property.status as PropertyStatus] ?? lead.property.status}
                    </Field>
                  )}
                </>
              ) : (
                <p className="text-slate-500">Chưa có căn nhà.</p>
              )}
              {lead.viewing && (
                <>
                  <Field label="Giờ xem nhà">
                    {formatDateTime(lead.viewing.viewingTime)}
                  </Field>
                  <Field label="Buổi xem">
                    {VIEWING_STATUS_LABELS[lead.viewing.status] ?? lead.viewing.status}
                  </Field>
                </>
              )}
            </Card>

            {lead.viewings?.length > 1 && (
              <Card title={`Lịch sử ${lead.viewings.length} buổi xem`}>
                <ViewingHistory viewings={lead.viewings} />
              </Card>
            )}

            {lead.otherBookings?.length > 0 && (
              <Card title={`Khách này đã đặt ${lead.otherBookings.length} lần khác`}>
                <ul className="space-y-1">
                  {lead.otherBookings.map((b) => (
                    <li key={b.id} className="flex flex-wrap items-center gap-2">
                      <Link href={`/admin/leads/${b.id}`} className="text-blue-600 hover:underline">
                        #{b.id} {b.propertyName ?? "Chưa có căn"}
                      </Link>
                      <LeadStatusBadge status={b.status} />
                      <span className="text-xs text-slate-500">
                        {b.viewingTime ? `hẹn ${formatDateTime(b.viewingTime)}` : `đặt ${formatDateTime(b.createdAt)}`}
                      </span>
                    </li>
                  ))}
                </ul>
              </Card>
            )}

            <LeadChatHistory leadId={lead.id} />

            <Card title="Kết quả AI">
              {lead.score === null ? (
                <p className="text-slate-500">Chưa chấm điểm.</p>
              ) : (
                <>
                  <Field label="Điểm">
                    <span className="font-semibold">{lead.score}/100</span>
                  </Field>
                  <Field label="Lý do">{lead.reason ?? "-"}</Field>
                  {lead.aiReply && (
                    <details className="text-xs">
                      <summary className="cursor-pointer text-blue-600">
                        Xem email AI soạn
                      </summary>
                      <p className="mt-1 whitespace-pre-line text-slate-600">
                        {lead.aiReply}
                      </p>
                    </details>
                  )}
                </>
              )}
            </Card>

            {feedback && feedback.submittedAt && (
              <Card title="Cảm nhận của khách">
                <Field label="Đánh giá">
                  <span className="inline-flex gap-0.5" role="img" aria-label={`${feedback.rating ?? 0} trên 5 sao`}>
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Icon key={n} name="star" filled={n <= (feedback.rating ?? 0)} className={`h-4 w-4 ${n <= (feedback.rating ?? 0) ? "text-amber-400" : "text-slate-300"}`} />
                    ))}
                  </span>
                </Field>
                <Field label="Lựa chọn">
                  {{ DEPOSIT: "Muốn đặt cọc", OTHER: "Muốn xem căn khác", NONE: "Không còn nhu cầu" }[feedback.interest ?? "NONE"]}
                </Field>
                <Field label="Góp ý">{feedback.comment ?? "-"}</Field>
                {feedback.aiSummary ? (
                  <div className="rounded-lg bg-blue-50 p-3 text-xs text-slate-700">
                    <p><b>AI tóm tắt ({feedback.aiSentiment}):</b> {feedback.aiSummary}</p>
                    <p className="mt-1"><b>Gợi ý:</b> {feedback.aiNextAction}</p>
                  </div>
                ) : (
                  <p className="text-xs text-slate-400">AI đang phân tích...</p>
                )}
              </Card>
            )}

            <Card title="Trạng thái xử lý">
              <Field label="n8n">
                <StatusBadge status={lead.automationStatus} />
              </Field>
              {lead.automationStatus === "FAILED" && lead.automationError && (
                <p className="rounded bg-rose-50 p-2 text-xs text-rose-700">
                  {lead.automationError}
                </p>
              )}
              <Field label="Đã gửi email">
                {lead.emailSent === null ? "-" : lead.emailSent ? "Có" : "Chưa"}
              </Field>
              <Field label="Đã báo NV">
                {lead.staffNotified === null
                  ? "-"
                  : lead.staffNotified
                    ? "Có"
                    : "Chưa"}
              </Field>
            </Card>
          </div>

          <div className="mt-4 rounded-xl border border-slate-200 bg-white p-5">
            <h2 className="text-sm font-semibold uppercase text-slate-500">
              Dòng thời gian
            </h2>
            {events.length === 0 ? (
              <p className="mt-3 text-sm text-slate-500">Chưa có sự kiện nào.</p>
            ) : (
              <ol className="mt-4 space-y-4 border-l-2 border-slate-200 pl-5">
                {events.map((ev) => (
                  <li key={ev.id} className="relative">
                    <span className="absolute -left-[27px] top-1.5 h-3 w-3 rounded-full bg-blue-500 ring-2 ring-white" />
                    <div className="flex flex-wrap items-baseline gap-x-3">
                      <span className="font-medium text-slate-900">
                        {eventLabel(ev.type)}
                      </span>
                      <span className="text-xs text-slate-500">
                        {formatDateTime(ev.createdAt)}
                      </span>
                    </div>
                    {ev.note && (
                      <p className="mt-0.5 text-sm text-slate-600">{ev.note}</p>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </div>
        </>
      )}
    </section>
  );
}
