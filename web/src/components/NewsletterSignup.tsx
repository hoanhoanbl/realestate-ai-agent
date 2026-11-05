import { NEWSLETTER_FORM_URL } from "@/lib/newsletter";

export default function NewsletterSignup() {
  if (!NEWSLETTER_FORM_URL) {
    return <p className="rounded-xl bg-slate-50 p-6 text-slate-600">Đăng ký bản tin đang được chuẩn bị. Bạn có thể quay lại sau.</p>;
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
      <iframe
        src={NEWSLETTER_FORM_URL}
        title="Form đăng ký nhận bản tin bất động sản"
        referrerPolicy="no-referrer"
        className="min-h-[640px] w-full border-0 sm:min-h-[560px]"
      />
      <p className="border-t border-slate-100 px-6 py-4 text-sm text-slate-600">
        Không thấy biểu mẫu?{" "}
        <a href={NEWSLETTER_FORM_URL} target="_blank" rel="noopener noreferrer" className="font-medium text-blue-700 underline underline-offset-2">
          Mở trang đăng ký riêng
        </a>
      </p>
    </div>
  );
}
