import type { Metadata } from "next";
import NewsletterSignup from "@/components/NewsletterSignup";

export const metadata: Metadata = {
  title: "Đăng ký nhận bản tin | RealEstate AI",
  description: "Nhận cập nhật thị trường và gợi ý bất động sản qua email mỗi tháng.",
};

export default function NewsletterPage() {
  return (
    <section className="mx-auto max-w-2xl">
      <p className="text-sm font-semibold uppercase tracking-wide text-blue-700">Bản tin bất động sản</p>
      <h1 className="mt-2 text-3xl font-bold tracking-tight text-slate-900">Tìm nhà theo nhịp của bạn</h1>
      <p className="mb-6 mt-4 leading-7 text-slate-600">
        Đăng ký nhận cập nhật thị trường và gợi ý nhà qua email hằng tháng.
        Bạn có thể hủy nhận bằng liên kết trong mỗi email.
      </p>
      <NewsletterSignup />
    </section>
  );
}
