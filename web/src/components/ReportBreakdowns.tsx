import { CARD } from "@/components/ui";
import { formatDateTime } from "@/lib/api";

export interface ReportBreakdownData {
  version: 1;
  asOf: string;
  sales: {
    userId: number | null;
    name: string;
    role: string | null;
    assignedLeads: number;
    activeLeads: number;
    respondedOnTime: number;
    overdueUnanswered: number;
    viewedLeads: number;
    depositLeads: number;
    signedLeads: number;
  }[];
  properties: {
    propertyId: number;
    name: string;
    status: string;
    scheduledViewings: number;
    uniqueVisitors: number;
    attendedViewings: number;
    attendedCustomers: number;
    cancelledViewings: number;
    noShowViewings: number;
    feedbackCount: number;
    averageRating: number | null;
    interestedCustomers: number;
    depositContracts: number;
    signedContracts: number;
    reasons: Record<string, number>;
  }[];
  dataQuality: { unmappedFeedbacks: number; unparsedAssignments: number };
}
const reasonLabels: Record<string, string> = {
  PRICE: "Giá/ngân sách",
  LOCATION: "Vị trí",
  SPACE: "Diện tích/phòng",
  CONDITION: "Tình trạng nhà",
  LEGAL: "Pháp lý",
  OTHER: "Khác",
};
const th = "px-3 py-3 text-left text-xs font-semibold text-slate-600";
const td = "px-3 py-3 text-sm text-slate-800";

export default function ReportBreakdowns({
  data,
}: {
  data?: ReportBreakdownData;
}) {
  if (!data || data.version !== 1)
    return (
      <div className={`p-5 ${CARD}`}>
        <p className="text-sm text-slate-500">
          Báo cáo này chưa có thống kê hiệu suất sale và hiệu quả căn nhà. Tạo
          báo cáo mới để xem.
        </p>
      </div>
    );
  return (
    <>
      <div className={`min-w-0 p-5 ${CARD}`}>
        <h3 className="font-semibold text-slate-900">Hiệu suất sale</h3>
        <p className="mt-1 text-xs text-slate-500">
          Khách đang phụ trách và quá hạn được chốt lúc{" "}
          {formatDateTime(data.asOf)}. Các kết quả còn lại thuộc kỳ báo cáo.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full whitespace-nowrap text-left">
            <caption className="sr-only">
              Số khách của từng sale, không xếp hạng hoặc so sánh kỳ trước
            </caption>
            <thead className="bg-slate-50">
              <tr>
                {[
                  "Sale",
                  "Được giao",
                  "Đang phụ trách",
                  "Phản hồi đúng hạn*",
                  "Quá hạn chưa trả lời",
                  "Đã đến xem",
                  "Tạo HĐ cọc",
                  "Đã ký",
                ].map((x) => (
                  <th key={x} scope="col" className={th}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.sales.map((s) => (
                <tr key={s.userId ?? "unknown"}>
                  <th scope="row" className={`${td} font-medium`}>
                    {s.name}
                    {s.role === "MANAGER" && (
                      <span className="ml-1 text-xs text-slate-500">
                        (quản lý)
                      </span>
                    )}
                  </th>
                  {[
                    s.assignedLeads,
                    s.activeLeads,
                    s.respondedOnTime,
                    s.overdueUnanswered,
                    s.viewedLeads,
                    s.depositLeads,
                    s.signedLeads,
                  ].map((n, i) => (
                    <td key={i} className={td}>
                      {n}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.sales.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có nhân viên hoặc hoạt động trong kỳ.
          </p>
        )}
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          * Đúng hạn tính trên phiên giao hiện tại bắt đầu trong kỳ; lịch sử
          phản hồi của phiên đã chuyển không được suy đoán. Mỗi chỉ số kết quả
          đếm khách duy nhất theo từng người. Một khách chuyển sale có thể xuất
          hiện ở nhiều dòng.
        </p>
      </div>
      <div className={`min-w-0 p-5 ${CARD}`}>
        <h3 className="font-semibold text-slate-900">Hiệu quả từng căn nhà</h3>
        <p className="mt-1 text-xs text-slate-500">
          Lịch có giờ hẹn trong kỳ; trạng thái được chốt lúc lập báo cáo. Cảm
          nhận theo ngày gửi, hợp đồng theo ngày tạo/ký.
        </p>
        <div className="mt-3 overflow-x-auto rounded-lg border border-slate-200">
          <table className="w-full text-left">
            <caption className="sr-only">
              Lịch xem, đánh giá và hợp đồng theo đúng căn nhà
            </caption>
            <thead className="whitespace-nowrap bg-slate-50">
              <tr>
                {[
                  "Căn nhà",
                  "Buổi/khách đặt xem",
                  "Khách đã đến",
                  "Huỷ/không đến",
                  "Đánh giá",
                  "Muốn cọc",
                  "HĐ cọc/đã ký",
                ].map((x) => (
                  <th key={x} scope="col" className={th}>
                    {x}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {data.properties.map((p) => (
                <tr key={p.propertyId}>
                  <th scope="row" className={`${td} min-w-48 font-medium`}>
                    <span>{p.name}</span>
                    <span className="block text-xs font-normal text-slate-500">
                      #{p.propertyId}
                    </span>
                  </th>
                  <td className={td}>
                    {p.scheduledViewings} / {p.uniqueVisitors}
                  </td>
                  <td className={td}>{p.attendedCustomers}</td>
                  <td className={td}>
                    {p.cancelledViewings} / {p.noShowViewings}
                  </td>
                  <td className={`${td} whitespace-nowrap`}>
                    {p.averageRating === null
                      ? "Chưa có"
                      : `${p.averageRating}/5`}
                    <span className="block text-xs text-slate-500">
                      {p.feedbackCount} phản hồi
                    </span>
                  </td>
                  <td className={td}>{p.interestedCustomers}</td>
                  <td className={td}>
                    {p.depositContracts} / {p.signedContracts}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {data.properties.length === 0 && (
          <p className="mt-3 text-sm text-slate-500">
            Chưa có căn nhà trong danh mục.
          </p>
        )}
        <div className="mt-4 space-y-2">
          {data.properties
            .filter((p) => Object.keys(p.reasons).length > 0)
            .map((p) => (
              <p key={p.propertyId} className="text-sm text-slate-600">
                <strong className="font-medium text-slate-800">
                  {p.name}:
                </strong>{" "}
                {Object.entries(p.reasons)
                  .map(([key, n]) => `${reasonLabels[key] ?? key}: ${n}`)
                  .join(" · ")}
              </p>
            ))}
        </div>
        <p className="mt-3 text-xs leading-relaxed text-slate-500">
          Chủ đề được nhắc trong nhận xét của khách chọn xem căn khác/không còn
          nhu cầu; một phản hồi có thể nhắc nhiều chủ đề. Đây là phân nhóm từ
          khoá, không phải kết luận nguyên nhân. “Muốn cọc” là ý định; “HĐ cọc”
          là hợp đồng được tạo, chưa đồng nghĩa đã nhận tiền.
        </p>
        {(data.dataQuality.unmappedFeedbacks > 0 ||
          data.dataQuality.unparsedAssignments > 0) && (
          <p className="mt-3 text-xs text-amber-700">
            Dữ liệu cần kiểm tra: {data.dataQuality.unmappedFeedbacks} phản hồi
            chưa xác định được căn; {data.dataQuality.unparsedAssignments} mốc
            giao khách chưa xác định được người nhận. Không gán vào căn/người
            hiện tại thay cho lịch sử.
          </p>
        )}
      </div>
    </>
  );
}
