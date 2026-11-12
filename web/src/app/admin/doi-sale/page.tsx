"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { Suspense, useCallback, useEffect, useState } from "react";
import { Alert, Badge, Button, CARD, EmptyState, Icon, PageHeader, Skeleton } from "@/components/ui";
import { useSession } from "@/lib/auth";
import { getTeamStats, type TeamOwner, type TeamPeriod, type TeamStats } from "@/lib/api";

const PERIODS: { value: TeamPeriod; label: string }[] = [
  { value: "now", label: "Hiện tại" },
  { value: "week", label: "Tuần này" },
  { value: "month", label: "Tháng này" },
];

// Cột "Hiện tại": mỗi cột là một trạng thái khách đang mở; status dùng cho link sang danh sách khách
const OPEN_COLUMNS = [
  { key: "CONSULTING", label: "Đang tư vấn" },
  { key: "NEW", label: "Chờ duyệt" },
  { key: "CONFIRMED", label: "Đã chốt lịch" },
  { key: "VIEWED", label: "Đã xem nhà" },
  { key: "DEPOSIT", label: "Đang cọc" },
] as const;

type NumberCell = { label: string; value: number; status?: string; tone?: "good" | "bad" };

// Danh sách khách của một người: /admin/leads?assignee=<id|none>&status=<STATUS>
function leadsHref(owner: TeamOwner, status?: string): string {
  const q = new URLSearchParams({ assignee: owner.id == null ? "none" : String(owner.id) });
  if (status) q.set("status", status);
  return `/admin/leads?${q.toString()}`;
}

function periodOf(raw: string | null): TeamPeriod {
  return raw === "week" || raw === "month" ? raw : "now";
}

// useSearchParams cần nằm trong Suspense
export default function TeamPage() {
  return (
    <Suspense fallback={<Skeleton className="h-64 rounded-xl" />}>
      <TeamContent />
    </Suspense>
  );
}

function TeamContent() {
  const session = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const period = periodOf(searchParams.get("period"));
  const isManager = session?.user.role === "MANAGER";

  const [loaded, setLoaded] = useState<TeamStats | null>(null);
  // Số của kỳ cũ không hiện dưới tiêu đề kỳ mới: kỳ chưa tải xong thì coi như chưa có dữ liệu
  const data = loaded && loaded.period === period ? loaded : null;
  const [error, setError] = useState<string | null>(null);
  const [version, setVersion] = useState(0);
  const retry = useCallback(() => {
    setError(null);
    setVersion((v) => v + 1);
  }, []);

  useEffect(() => {
    if (!isManager) return;
    let cancelled = false;
    getTeamStats(period)
      .then((d) => {
        if (cancelled) return;
        setLoaded(d);
        setError(null);
      })
      .catch((e: unknown) => {
        if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [period, isManager, version]);

  if (session && session.user.role !== "MANAGER") {
    return <Alert tone="warning">Chỉ quản lý được xem trang Đội sale.</Alert>;
  }

  function choose(next: TeamPeriod) {
    const q = new URLSearchParams(searchParams.toString());
    if (next === "now") q.delete("period");
    else q.set("period", next);
    const qs = q.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  }

  return (
    <section>
      <PageHeader
        title="Đội sale"
        description={
          period === "now"
            ? "Mỗi sale đang giữ bao nhiêu khách chưa xong và khách nào cần để ý ngay."
            : `Kết quả của từng sale ${period === "week" ? "trong tuần này" : "trong tháng này"}, tính theo người đang phụ trách khách.`
        }
        actions={<PeriodSwitch value={period} onChange={choose} />}
      />
      {data?.from && (
        <p className="mt-1 text-xs text-slate-500">
          Từ {new Date(data.from).toLocaleDateString("vi-VN", { timeZone: "Asia/Ho_Chi_Minh" })} đến hiện tại (giờ Việt Nam)
        </p>
      )}

      {error && (
        <div className="mt-4 flex flex-wrap items-center gap-3">
          <Alert className="flex-1">{error}</Alert>
          <Button variant="secondary" onClick={retry}>
            Thử lại
          </Button>
        </div>
      )}

      {!data && !error && <TeamSkeleton />}

      {data && data.owners.length === 0 && (
        <EmptyState
          className="mt-4"
          title="Chưa có nhân viên sale"
          description="Tạo tài khoản sale ở trang Tài khoản để bắt đầu chia khách."
          action={
            <Link href="/admin/tai-khoan" className="text-sm font-medium text-brand-700 hover:underline">
              Mở trang Tài khoản
            </Link>
          }
        />
      )}

      {data && data.owners.length > 0 && (
        <>
          <Kpis data={data} />
          <TeamTable data={data} />
          <TeamCards data={data} />
        </>
      )}
    </section>
  );
}

function PeriodSwitch({ value, onChange }: { value: TeamPeriod; onChange: (p: TeamPeriod) => void }) {
  return (
    <div role="group" aria-label="Chọn kỳ xem" className="inline-flex rounded-lg bg-white p-1 ring-1 ring-slate-200">
      {PERIODS.map((p) => (
        <button
          key={p.value}
          type="button"
          aria-pressed={value === p.value}
          onClick={() => onChange(p.value)}
          className={`min-h-11 rounded-md px-3.5 text-sm font-medium transition sm:min-h-9 ${
            value === p.value ? "bg-brand-600 text-white" : "text-slate-600 hover:bg-slate-50"
          }`}
        >
          {p.label}
        </button>
      ))}
    </div>
  );
}

function Kpis({ data }: { data: TeamStats }) {
  const t = data.totals;
  const cards =
    data.period === "now"
      ? [
          { label: "Khách đang mở", value: String(t.open.total) },
          { label: "Trễ phản hồi (quá hạn, chưa ai trả lời)", value: String(t.overdue), alert: t.overdue > 0 },
          { label: "Im quá 7 ngày (không ai đụng tới)", value: String(t.idle), warn: t.idle > 0 },
          { label: "Sale đang nhận khách", value: `${data.acceptingSales}/${data.totalSales}` },
        ]
      : [
          { label: "Khách mới được chia", value: String(t.assigned) },
          { label: "Đã xem nhà", value: String(t.attended) },
          { label: "Ký hợp đồng cọc", value: String(t.signed) },
          { label: "Không mua", value: String(t.lost), alert: t.lost > 0 },
        ];
  return (
    <dl className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
      {cards.map((c) => (
        <div key={c.label} className={`p-4 ${CARD}`}>
          <dt className="text-xs text-slate-500">{c.label}</dt>
          <dd
            className={`mt-1 flex items-center gap-1.5 text-2xl font-bold ${
              c.alert ? "text-rose-700" : c.warn ? "text-amber-700" : "text-slate-900"
            }`}
          >
            {(c.alert || c.warn) && <Icon name={c.alert ? "alert" : "clock"} className="h-5 w-5" />}
            {c.value}
          </dd>
        </div>
      ))}
    </dl>
  );
}

// Dòng số liệu của một người theo kỳ đang chọn
function cellsFor(o: TeamOwner, period: TeamPeriod): NumberCell[] {
  if (period === "now") {
    return [
      ...OPEN_COLUMNS.map((c) => ({ label: c.label, value: o.open[c.key], status: c.key })),
      { label: "Tổng đang mở", value: o.open.total },
    ];
  }
  return [
    { label: "Khách mới được chia", value: o.assigned },
    { label: "Đã xem nhà", value: o.attended },
    { label: "Ký cọc", value: o.signed, status: "SIGNED", tone: "good" },
    { label: "Không mua", value: o.lost, status: "LOST", tone: "bad" },
  ];
}

function headersFor(period: TeamPeriod): string[] {
  return period === "now" ? [...OPEN_COLUMNS.map((c) => c.label), "Tổng đang mở"] : ["Khách mới được chia", "Đã xem nhà", "Ký cọc", "Không mua"];
}

// Số khách: bấm được khi lớn hơn 0, mở danh sách khách của người đó (kèm trạng thái nếu số thuộc một trạng thái)
function Count({ owner, cell }: { owner: TeamOwner; cell: NumberCell }) {
  if (cell.value === 0) {
    return (
      <span className="text-slate-400" aria-label={`${owner.name}: không có khách ${cell.label.toLowerCase()}`}>
        0
      </span>
    );
  }
  const tone = cell.tone === "good" ? "text-emerald-700" : cell.tone === "bad" ? "text-rose-700" : "text-slate-900";
  return (
    <Link
      href={leadsHref(owner, cell.status)}
      aria-label={`${owner.name}: ${cell.value} khách ${cell.label.toLowerCase()}, mở danh sách`}
      className={`inline-flex min-h-11 min-w-11 items-center justify-center rounded-md px-2 font-semibold underline-offset-2 hover:bg-brand-50 hover:underline focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-brand-500 md:min-h-9 ${tone}`}
    >
      {cell.value}
    </Link>
  );
}

function Flags({ owner }: { owner: TeamOwner }) {
  if (owner.overdue === 0 && owner.idle === 0) return <span className="text-slate-400">Không có</span>;
  return (
    <div className="flex flex-wrap gap-1.5">
      {owner.overdue > 0 && (
        <Link href={leadsHref(owner)} className="inline-flex min-h-11 items-center md:min-h-0" aria-label={`${owner.name}: ${owner.overdue} khách trễ phản hồi, mở danh sách`}>
          <Badge tone="red" className="gap-1">
            <Icon name="alert" className="h-3.5 w-3.5" />
            {owner.overdue} trễ phản hồi
          </Badge>
        </Link>
      )}
      {owner.idle > 0 && (
        <Link href={leadsHref(owner)} className="inline-flex min-h-11 items-center md:min-h-0" aria-label={`${owner.name}: ${owner.idle} khách im quá 7 ngày, mở danh sách`}>
          <Badge tone="amber" className="gap-1">
            <Icon name="clock" className="h-3.5 w-3.5" />
            {owner.idle} im quá 7 ngày
          </Badge>
        </Link>
      )}
    </div>
  );
}

function AcceptingBadge({ owner }: { owner: TeamOwner }) {
  if (owner.acceptingLeads == null) return null;
  return owner.acceptingLeads ? <Badge tone="green">Đang nhận khách</Badge> : <Badge tone="neutral">Tạm ngừng nhận</Badge>;
}

function initials(name: string): string {
  return name.split(" ").slice(-2).map((w) => w[0]).join("").toUpperCase();
}

function OwnerName({ owner }: { owner: TeamOwner }) {
  return (
    <div className="flex min-w-0 items-center gap-2.5">
      <span aria-hidden className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-brand-50 text-xs font-bold text-brand-700">
        {initials(owner.name)}
      </span>
      <div className="min-w-0">
        <Link href={leadsHref(owner)} className="flex min-h-11 items-center font-semibold text-slate-900 hover:text-brand-700 hover:underline md:min-h-0">
          {owner.name}
        </Link>
        <div className="mt-0.5 flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-slate-500">
            {owner.role === "SALE" ? "Sale" : owner.role === "MANAGER" ? "Nhận khách khi không còn sale nào nhận" : "Khách chưa giao cho ai"}
          </span>
          <AcceptingBadge owner={owner} />
        </div>
      </div>
    </div>
  );
}

function groups(data: TeamStats) {
  return [
    { title: null as string | null, owners: data.owners.filter((o) => o.role === "SALE") },
    { title: "Ngoài đội sale", owners: data.owners.filter((o) => o.role !== "SALE") },
  ].filter((g) => g.owners.length > 0);
}

function rate(o: TeamOwner): string {
  return o.assigned > 0 ? `${Math.round((o.signed / o.assigned) * 100)}%` : "—";
}

function TeamTable({ data }: { data: TeamStats }) {
  const heads = headersFor(data.period);
  const cols = heads.length + 2;
  return (
    <div className={`mt-4 hidden overflow-x-auto md:block ${CARD}`}>
      <table className="w-full min-w-[820px] text-left text-sm">
        <caption className="sr-only">
          {data.period === "now" ? "Khách đang mở của từng người phụ trách" : "Kết quả của từng người phụ trách trong kỳ"}. Bấm tên hoặc một số để mở danh sách khách.
        </caption>
        <thead className="border-b border-slate-200 bg-slate-50 text-xs font-semibold uppercase tracking-wide text-slate-500">
          <tr>
            <th scope="col" className="px-4 py-3">
              Người phụ trách
            </th>
            {heads.map((h) => (
              <th key={h} scope="col" className="px-2 py-3 text-center">
                {h}
              </th>
            ))}
            <th scope="col" className="px-4 py-3">
              {data.period === "now" ? "Cần chú ý" : "Tỉ lệ ký / khách mới"}
            </th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {groups(data).map((g) => (
            <Group key={g.title ?? "sale"} title={g.title} cols={cols}>
              {g.owners.map((o) => (
                <tr key={o.id ?? "none"} className="transition hover:bg-slate-50">
                  <th scope="row" className="px-4 py-2.5 font-normal">
                    <OwnerName owner={o} />
                  </th>
                  {cellsFor(o, data.period).map((c) => (
                    <td key={c.label} className={`px-2 py-2.5 text-center ${c.label === "Tổng đang mở" ? "bg-slate-50" : ""}`}>
                      <Count owner={o} cell={c} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">{data.period === "now" ? <Flags owner={o} /> : <span className="font-medium text-slate-700">{rate(o)}</span>}</td>
                </tr>
              ))}
            </Group>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Group({ title, cols, children }: { title: string | null; cols: number; children: React.ReactNode }) {
  return (
    <>
      {title && (
        <tr className="bg-slate-50">
          <th colSpan={cols} scope="colgroup" className="px-4 py-2 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            {title}
          </th>
        </tr>
      )}
      {children}
    </>
  );
}

// Điện thoại: mỗi người một thẻ, cùng số liệu và liên kết như bảng
function TeamCards({ data }: { data: TeamStats }) {
  return (
    <div className="mt-4 space-y-4 md:hidden">
      {groups(data).map((g) => (
        <div key={g.title ?? "sale"}>
          {g.title && <h2 className="mb-2 text-xs font-semibold uppercase tracking-wide text-slate-500">{g.title}</h2>}
          <ul className="space-y-3">
            {g.owners.map((o) => (
              <li key={o.id ?? "none"} className={`p-4 ${CARD}`}>
                <OwnerName owner={o} />
                <dl className="mt-3 grid grid-cols-3 gap-x-2 gap-y-1 text-center">
                  {cellsFor(o, data.period).map((c) => (
                    <div key={c.label}>
                      <dt className="text-xs text-slate-500">{c.label}</dt>
                      <dd>
                        <Count owner={o} cell={c} />
                      </dd>
                    </div>
                  ))}
                </dl>
                <div className="mt-3 border-t border-slate-100 pt-3 text-sm">
                  {data.period === "now" ? (
                    <Flags owner={o} />
                  ) : (
                    <p className="text-slate-600">
                      Tỉ lệ ký / khách mới: <span className="font-semibold text-slate-900">{rate(o)}</span>
                    </p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </div>
  );
}

function TeamSkeleton() {
  return (
    <div aria-busy="true" aria-label="Đang tải số liệu đội sale">
      <div className="mt-4 grid grid-cols-2 gap-3 md:grid-cols-4">
        {Array.from({ length: 4 }, (_, i) => (
          <Skeleton key={i} className="h-20 rounded-xl" />
        ))}
      </div>
      <div className="mt-4 space-y-2">
        {Array.from({ length: 6 }, (_, i) => (
          <Skeleton key={i} className="h-14 rounded-xl" />
        ))}
      </div>
    </div>
  );
}
