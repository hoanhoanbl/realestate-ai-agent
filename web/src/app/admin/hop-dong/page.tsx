"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import ContractStatusBadge from "@/components/ContractStatusBadge";
import { formatDateTime, formatVnd, getContracts, type ContractRow } from "@/lib/api";

const POLL_MS = 10000;

export default function ContractsPage() {
  const [rows, setRows] = useState<ContractRow[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    function load() {
      getContracts()
        .then((data) => {
          if (cancelled) return;
          setRows(data);
          setError(null);
        })
        .catch((e: unknown) => {
          if (!cancelled) setError(e instanceof Error ? e.message : "Lỗi không xác định.");
        });
    }
    load();
    const timer = setInterval(load, POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(timer);
    };
  }, []);

  const pending = (rows ?? []).filter((r) => r.status === "PENDING_APPROVAL").length;

  return (
    <section>
      <h1 className="text-2xl font-bold text-slate-900">Hợp đồng đặt cọc</h1>
      <p className="mt-1 text-sm text-slate-600">
        Tạo hợp đồng từ trang chi tiết của khách đã xem nhà. AI soạn, quản lý duyệt, khách ký online.
        {pending > 0 && <b className="ml-1 text-amber-700">Đang có {pending} hợp đồng chờ duyệt.</b>}
      </p>

      {error && (
        <p role="alert" className="mt-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 ring-1 ring-red-200">
          {error}
        </p>
      )}
      {rows === null && !error && <p className="mt-6 text-slate-500">Đang tải...</p>}

      {rows !== null && (
        <div className="mt-5 overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="w-full min-w-[800px] text-left text-sm">
            <thead className="bg-slate-50 text-xs uppercase text-slate-500">
              <tr>
                <th className="px-3 py-3">#</th>
                <th className="px-3 py-3">Khách</th>
                <th className="px-3 py-3">Căn nhà</th>
                <th className="px-3 py-3">Tiền cọc</th>
                <th className="px-3 py-3">Trạng thái</th>
                <th className="px-3 py-3">Tạo lúc</th>
                <th className="px-3 py-3">Ký lúc</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-3 py-8 text-center text-slate-500">
                    Chưa có hợp đồng nào.
                  </td>
                </tr>
              )}
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-slate-50">
                  <td className="px-3 py-3">
                    <Link href={`/admin/hop-dong/${r.id}`} className="font-medium text-blue-700 hover:underline">
                      HD-{String(r.id).padStart(4, "0")}
                    </Link>
                  </td>
                  <td className="px-3 py-3">
                    <Link href={`/admin/leads/${r.leadId}`} className="hover:underline">
                      {r.leadName}
                    </Link>
                  </td>
                  <td className="max-w-[260px] px-3 py-3 text-slate-600">{r.propertyName}</td>
                  <td className="whitespace-nowrap px-3 py-3">{formatVnd(r.depositAmount)}</td>
                  <td className="px-3 py-3">
                    <ContractStatusBadge status={r.status} />
                  </td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">{formatDateTime(r.createdAt)}</td>
                  <td className="whitespace-nowrap px-3 py-3 text-xs text-slate-500">
                    {r.signedAt ? formatDateTime(r.signedAt) : "-"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
