import Link from "next/link";
import Icon from "./Icon";

// Link "quay lại" đầu trang: có icon, vùng bấm cao 44px trên điện thoại
export default function BackLink({ href, children, className = "" }: { href: string; children: React.ReactNode; className?: string }) {
  return (
    <Link
      href={href}
      className={`-ml-2 inline-flex min-h-11 items-center gap-1.5 rounded-lg px-2 text-sm font-medium text-brand-600 transition-colors hover:bg-brand-50 hover:text-brand-700 sm:min-h-9 ${className}`}
    >
      <Icon name="arrowLeft" className="h-4 w-4" />
      {children}
    </Link>
  );
}
