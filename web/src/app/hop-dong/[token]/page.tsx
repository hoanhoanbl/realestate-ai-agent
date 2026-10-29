"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ContractDocument from "@/components/ContractDocument";
import PrintToolbar from "@/components/PrintToolbar";
import { Alert, Skeleton } from "@/components/ui";
import { ApiError, getSignInfo, type SignInfo } from "@/lib/api";
import { contractCode } from "@/lib/contract";

// Bản hợp đồng của khách để xem lại và in / lưu PDF. Nằm ngoài khu (khach) để bản in không có thanh điều hướng.
// Truy cập bằng token bí mật trong email ký, giống trang /ky/[token]
export default function CustomerContractPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[60vh] max-w-[210mm]" />}>
      <CustomerContract />
    </Suspense>
  );
}

function CustomerContract() {
  const params = useParams<{ token: string }>();
  const token = params.token;
  const [info, setInfo] = useState<SignInfo | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    getSignInfo(token)
      .then((data) => {
        if (cancelled) return;
        setInfo(data);
        document.title = `${contractCode(data.id)} - Hợp đồng đặt cọc`;
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? "Liên kết không hợp lệ hoặc đã bị thay đổi." : e instanceof Error ? e.message : "Không tải được hợp đồng.");
      });
    return () => {
      cancelled = true;
    };
  }, [token]);

  return (
    <main className="min-h-full flex-1 bg-slate-100 print:bg-white">
      <PrintToolbar
        backHref={`/ky/${encodeURIComponent(token)}`}
        backLabel="Về trang ký"
        title={info ? `${contractCode(info.id)} · ${info.customerName}` : "Hợp đồng đặt cọc"}
      />
      <div className="px-2 py-6 sm:px-4 print:p-0">
        {error && <Alert className="mx-auto max-w-[210mm]">{error}</Alert>}
        {!info && !error && <Skeleton className="mx-auto h-[60vh] max-w-[210mm]" />}
        {info && (
          <ContractDocument
            data={{
              id: info.id,
              content: info.content,
              status: info.status,
              approvedBy: info.approvedBy,
              signerName: info.signerName,
              signature: info.signature,
              signedAt: info.signedAt,
            }}
          />
        )}
      </div>
    </main>
  );
}
