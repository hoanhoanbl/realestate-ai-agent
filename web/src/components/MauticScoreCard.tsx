import LevelBadge from "@/components/LevelBadge";
import type { LeadDetail } from "@/lib/api";

interface MauticScoreCardProps {
  lead: LeadDetail;
}

export default function MauticScoreCard({ lead }: MauticScoreCardProps) {
  const mauticUrl =
    process.env.NEXT_PUBLIC_MAUTIC_URL || "https://mautic.136-85-40-9.sslip.io";
  const points = lead.mauticPoints ?? 0;
  const score = lead.score ?? null;
  const isHot = lead.level === "HOT" || (score !== null && score >= 75);
  const isHighEngagement = points >= 20;

  // Ma trận 2 trục (Two-Axis Scoring Matrix)
  let matrixTag = "";
  let matrixColor = "";
  let matrixAdvice = "";

  if (isHot && isHighEngagement) {
    matrixTag = "🚀 Ưu tiên số 1 - Chốt cọc ngay";
    matrixColor = "bg-rose-50 text-rose-800 border-rose-200";
    matrixAdvice =
      "Khách có tiềm năng ngân sách cao VÀ tương tác tích cực (mở email, xem nhà). Nhân viên kinh doanh nên gọi điện tư vấn chốt lịch/hợp đồng ngay!";
  } else if (isHot && !isHighEngagement) {
    matrixTag = "⏳ Tiềm năng cao nhưng đang nguội";
    matrixColor = "bg-amber-50 text-amber-800 border-amber-200";
    matrixAdvice =
      "Nhu cầu ban đầu rất tốt nhưng khách chưa tương tác nhiều qua email. Đề xuất nhân viên chủ động gọi điện thoại hoặc nhắn tin Zalo hỗ trợ trực tiếp.";
  } else if (!isHot && isHighEngagement) {
    matrixTag = "🔥 Tương tác bứt phá - Cần ưu tiên";
    matrixColor = "bg-purple-50 text-purple-800 border-purple-200";
    matrixAdvice =
      "Ban đầu đánh giá trung bình nhưng khách có hành vi quan tâm đặc biệt (xem lại nhà nhiều lần). Cơ hội nâng hạng lead lên HOT và liên hệ lại.";
  } else {
    matrixTag = "📨 Đang nuôi dưỡng tự động (Mautic)";
    matrixColor = "bg-slate-50 text-slate-700 border-slate-200";
    matrixAdvice =
      "Khách hàng đang được chiến dịch Mautic gửi email định kỳ tự động. Hệ thống sẽ cảnh báo khi khách click link hoặc tăng điểm tương tác.";
  }

  // Phân cấp mức tương tác Mautic
  const engagementLevel =
    points >= 30
      ? { label: "Rất cao", color: "text-rose-600 bg-rose-50" }
      : points >= 15
        ? { label: "Trung bình", color: "text-amber-600 bg-amber-50" }
        : { label: "Mới / Thấp", color: "text-slate-600 bg-slate-100" };

  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
        <div className="flex items-center gap-2">
          <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-indigo-600 text-xs font-bold text-white">
            2X
          </span>
          <h2 className="text-sm font-semibold uppercase text-slate-700">
            Đánh giá & Chấm điểm 2 trục
          </h2>
        </div>
        {lead.mauticContactId ? (
          <a
            href={`${mauticUrl}/s/contacts/view/${lead.mauticContactId}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium text-indigo-600 hover:text-indigo-800 hover:underline"
          >
            Mautic Contact #{lead.mauticContactId} ↗
          </a>
        ) : (
          <span className="text-xs text-slate-400">Chưa liên kết Mautic</span>
        )}
      </div>

      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        {/* Trục 1: AI Score */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">
              Trục 1: AI Score (Tiềm năng)
            </span>
            <LevelBadge level={lead.level} />
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-slate-900">
              {score !== null ? `${score}` : "--"}
            </span>
            <span className="text-xs text-slate-400">/ 100 điểm</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className={`h-full rounded-full transition-all duration-300 ${
                (score ?? 0) >= 70
                  ? "bg-red-500"
                  : (score ?? 0) >= 40
                    ? "bg-amber-500"
                    : "bg-sky-500"
              }`}
              style={{ width: `${Math.min(score ?? 0, 100)}%` }}
            />
          </div>
          <p className="mt-2 line-clamp-2 text-xs text-slate-600">
            {lead.reason || "Chưa có lý do phân tích từ AI."}
          </p>
        </div>

        {/* Trục 2: Mautic Points */}
        <div className="rounded-lg border border-slate-100 bg-slate-50/70 p-3.5">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase text-slate-500">
              Trục 2: Mautic Points (Hành vi)
            </span>
            <span
              className={`rounded px-2 py-0.5 text-[11px] font-semibold ${engagementLevel.color}`}
            >
              {engagementLevel.label}
            </span>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-black text-indigo-600">
              +{points}
            </span>
            <span className="text-xs text-slate-400">điểm tương tác</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-slate-200">
            <div
              className="h-full rounded-full bg-indigo-500 transition-all duration-300"
              style={{ width: `${Math.min((points / 50) * 100, 100)}%` }}
            />
          </div>
          <p className="mt-2 text-xs text-slate-600">
            {points > 0
              ? `Khách đã mở email, bấm link hoặc xem lại căn nhà.`
              : `Chưa ghi nhận hành vi tương tác mới từ Mautic.`}
          </p>
        </div>
      </div>

      {/* Ma trận hành động khuyến nghị */}
      <div
        className={`mt-4 rounded-lg border p-3 text-xs leading-relaxed ${matrixColor}`}
      >
        <p className="font-bold">{matrixTag}</p>
        <p className="mt-1">{matrixAdvice}</p>
      </div>
    </div>
  );
}
