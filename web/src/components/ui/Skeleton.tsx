// Khối xám nhấp nháy thay cho chữ "Đang tải..."
export default function Skeleton({ className = "" }: { className?: string }) {
  return <div aria-hidden className={`animate-pulse rounded-md bg-slate-200 ${className}`} />;
}
