"use client";

import { useEffect, useState } from "react";
import { CHAT_ROUTE_LABELS, formatDateTime, getLeadChatLogs, type LeadChatLog } from "@/lib/api";

// Lịch sử chat Telegram của khách với bot (FE-36). Chỉ hiện khi khách có chat; lỗi tải thì ẩn, không làm hỏng trang.
export default function LeadChatHistory({ leadId }: { leadId: number }) {
  const [logs, setLogs] = useState<LeadChatLog[]>([]);

  useEffect(() => {
    let cancelled = false;
    getLeadChatLogs(leadId)
      .then((data) => {
        if (!cancelled) setLogs(data);
      })
      .catch(() => {
        if (!cancelled) setLogs([]);
      });
    return () => {
      cancelled = true;
    };
  }, [leadId]);

  if (logs.length === 0) return null;

  return (
    <div className="min-w-0 rounded-xl border border-slate-200 bg-white p-4 sm:p-5 md:col-span-2">
      <details open={logs.length <= 10}>
        <summary className="cursor-pointer text-sm font-semibold uppercase text-slate-500">
          Lịch sử chat Telegram ({logs.length})
        </summary>
        <ol className="mt-3 max-h-[28rem] space-y-3 overflow-y-auto pr-1 text-sm">
          {logs.map((log) => (
            <li key={log.id} className="space-y-1.5">
              <p className="text-xs text-slate-500">
                {formatDateTime(log.createdAt)} · {CHAT_ROUTE_LABELS[log.route] ?? log.route}
                {log.escalated && (
                  <span className="ml-2 rounded-full bg-amber-50 px-2 py-0.5 font-medium text-amber-800 ring-1 ring-amber-200">
                    đã báo nhân viên
                  </span>
                )}
              </p>
              <p className="max-w-[85%] rounded-2xl rounded-tl-sm bg-slate-100 px-3 py-2 text-slate-800 [overflow-wrap:anywhere] whitespace-pre-line">
                {log.question}
              </p>
              <p className="ml-auto max-w-[85%] rounded-2xl rounded-tr-sm bg-blue-50 px-3 py-2 text-slate-800 ring-1 ring-blue-100 [overflow-wrap:anywhere] whitespace-pre-line">
                {log.reply}
              </p>
            </li>
          ))}
        </ol>
      </details>
    </div>
  );
}
