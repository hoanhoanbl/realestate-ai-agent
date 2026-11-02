"use client";

import { useParams } from "next/navigation";
import { Suspense, useEffect, useState } from "react";
import ContractDocument from "@/components/ContractDocument";
import PrintToolbar from "@/components/PrintToolbar";
import { Alert, Skeleton } from "@/components/ui";
import { ApiError, getContract, type ContractDetail } from "@/lib/api";
import { contractCode } from "@/lib/contract";

// Trang in hợp đồng (khổ A4). AdminShell không vẽ menu cho đường dẫn kết thúc bằng /in
export default function ContractPrintPage() {
  return (
    <Suspense fallback={<Skeleton className="mx-auto mt-8 h-[60vh] max-w-[210mm]" />}>
      <ContractPrint />
    </Suspense>
  );
}

function ContractPrint() {
  const params = useParams<{ id: string }>();
  const id = Number(params.id);
  const [contract, setContract] = useState<ContractDetail | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!Number.isInteger(id) || id <= 0) return;
    let cancelled = false;
    getContract(id)
      .then((data) => {
        if (cancelled) return;
        setContract(data);
        // Tên file khi "Lưu dưới dạng PDF" lấy theo tiêu đề trang
        document.title = `${contractCode(data.id)} - ${data.lead?.name ?? "hop-dong"}`;
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        setError(e instanceof ApiError && e.status === 404 ? "Không tìm thấy hợp đồng." : e instanceof Error ? e.message : "Lỗi không xác định.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  return (
    <>
      <PrintToolbar
        backHref={`/admin/hop-dong/${id}`}
        backLabel="Về chi tiết hợp đồng"
        title={contract ? `${contractCode(contract.id)} · ${contract.lead?.name ?? ""}` : "Bản in hợp đồng"}
      />
      <div className="px-2 py-6 sm:px-4 print:p-0">
        {error && <Alert className="mx-auto max-w-[210mm]">{error}</Alert>}
        {!contract && !error && <Skeleton className="mx-auto h-[60vh] max-w-[210mm]" />}
        {contract && (
          <ContractDocument
            data={{
              id: contract.id,
              content: contract.content,
              status: contract.status,
              approvedBy: contract.approvedBy,
              signerName: contract.signerName,
              signature: contract.signature,
              signedAt: contract.signedAt,
              signedIp: contract.signedIp,
            }}
          />
        )}
      </div>
    </>
  );
}
