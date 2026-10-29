import type { ContractStatus } from "@/lib/api";
import { contractCode } from "@/lib/contract";
import { formatDateTime } from "@/lib/api";

export interface ContractDocumentData {
  id: number;
  content: string | null;
  status: ContractStatus;
  approvedBy: string | null;
  signerName: string | null;
  signature: string | null;
  signedAt: string | null;
  // Chỉ bản nội bộ mới in IP lúc ký
  signedIp?: string | null;
}

type Block =
  | { kind: "motto"; text: string; strong: boolean }
  | { kind: "title"; text: string }
  | { kind: "meta"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "bullet"; text: string }
  | { kind: "note"; text: string }
  | { kind: "para"; text: string };

// Toàn văn do n8n soạn là chữ thường: tách dòng rồi nhận dạng quốc hiệu, tiêu đề, "Điều N.", gạch đầu dòng
function parseContent(content: string): Block[] {
  const lines = content.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let seenParty = false;
  return lines.map((text, i): Block => {
    if (i === 0 && /CỘNG HÒA/i.test(text)) return { kind: "motto", text, strong: true };
    if (i === 1 && /Độc lập/i.test(text)) return { kind: "motto", text, strong: false };
    if (/^HỢP ĐỒNG/.test(text) && text === text.toUpperCase()) return { kind: "title", text };
    if (!seenParty && /^(Số|Ngày lập)\s*:/i.test(text)) return { kind: "meta", text };
    if (/^BÊN /.test(text)) seenParty = true;
    if (/^Điều\s+\d+/i.test(text)) return { kind: "heading", text };
    if (/^[-•]\s+/.test(text)) return { kind: "bullet", text: text.replace(/^[-•]\s+/, "") };
    if (/ký điện tử|không có giá trị pháp lý/i.test(text)) return { kind: "note", text };
    return { kind: "para", text };
  });
}

function renderBlock(b: Block, i: number) {
  switch (b.kind) {
    case "motto":
      return (
        <p key={i} className={`text-center ${b.strong ? "font-bold uppercase" : "font-semibold underline underline-offset-4"}`}>
          {b.text}
        </p>
      );
    case "title":
      return (
        <h2 key={i} className="pt-6 text-center text-lg font-bold uppercase">
          {b.text}
        </h2>
      );
    case "meta":
      return (
        <p key={i} className="text-center italic">
          {b.text}
        </p>
      );
    case "heading":
      return (
        <h3 key={i} className="pt-3 font-bold">
          {b.text}
        </h3>
      );
    case "bullet":
      return (
        <p key={i} className="pl-6 -indent-4">
          –&nbsp;&nbsp;{b.text}
        </p>
      );
    case "note":
      return (
        <p key={i} className="pt-3 text-sm italic text-slate-600">
          {b.text}
        </p>
      );
    default:
      return (
        <p key={i} className="text-justify">
          {b.text}
        </p>
      );
  }
}

// Bản hợp đồng khổ A4: dùng cho trang in của quản lý và bản lưu của khách
export default function ContractDocument({ data }: { data: ContractDocumentData }) {
  const signed = data.status === "SIGNED";
  const blocks = data.content ? parseContent(data.content) : [];

  return (
    <article className="contract-paper relative mx-auto bg-white text-[15px] leading-relaxed text-slate-900">
      {!signed && (
        <p
          aria-hidden
          className="pointer-events-none absolute inset-0 flex items-center justify-center text-7xl font-bold uppercase text-slate-900/5 -rotate-30"
        >
          Chưa ký
        </p>
      )}

      {blocks.length > 0 ? (
        <div className="space-y-1.5">{blocks.map(renderBlock)}</div>
      ) : (
        <p className="text-center italic text-slate-500">Hợp đồng chưa có nội dung.</p>
      )}

      <div className="mt-10 grid grid-cols-2 gap-8 text-center break-inside-avoid">
        <div>
          <p className="font-bold uppercase">Đại diện Bên A</p>
          <p className="text-sm italic text-slate-600">(Bên nhận đặt cọc)</p>
          <div className="mt-4 flex h-24 items-center justify-center">
            {data.approvedBy ? (
              <span className="rounded border-2 border-rose-600 px-3 py-1 text-sm font-bold uppercase text-rose-600 [transform:rotate(-6deg)]">
                Đã duyệt điện tử
              </span>
            ) : (
              <span className="text-sm text-slate-400">Chưa duyệt</span>
            )}
          </div>
          <p className="font-semibold">{data.approvedBy ?? "................................"}</p>
        </div>
        <div>
          <p className="font-bold uppercase">Bên B</p>
          <p className="text-sm italic text-slate-600">(Bên đặt cọc)</p>
          <div className="mt-4 flex h-24 items-center justify-center">
            {signed && data.signature ? (
              // Chữ ký là ảnh base64 do khách vẽ, không qua next/image
              // eslint-disable-next-line @next/next/no-img-element
              <img src={data.signature} alt={`Chữ ký của ${data.signerName ?? "khách"}`} className="max-h-24 max-w-full object-contain" />
            ) : (
              <span className="text-sm text-slate-400">Chưa ký</span>
            )}
          </div>
          <p className="font-semibold">{data.signerName ?? "................................"}</p>
          {data.signedAt && <p className="text-sm text-slate-600">Ký lúc {formatDateTime(data.signedAt)}</p>}
        </div>
      </div>

      <footer className="mt-10 border-t border-slate-300 pt-3 font-sans text-xs text-slate-500">
        Mã hợp đồng {contractCode(data.id)}
        {signed && data.signedAt && <> · Ký điện tử qua RealEstate AI lúc {formatDateTime(data.signedAt)}</>}
        {data.signedIp && <> · IP {data.signedIp}</>}
      </footer>
    </article>
  );
}
