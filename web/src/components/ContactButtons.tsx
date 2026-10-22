// Nút liên hệ nhanh với khách (UC-S10). Mở trên điện thoại thì bấm Gọi là gọi luôn.
export default function ContactButtons({ phone, email }: { phone: string; email: string }) {
  const tel = phone.replace(/[^\d+]/g, "");
  return (
    <div className="flex flex-wrap gap-2">
      {tel && (
        <a
          href={`tel:${tel}`}
          className="rounded-lg bg-emerald-600 px-4 py-2 text-sm font-medium text-white hover:bg-emerald-700"
        >
          Gọi {phone}
        </a>
      )}
      {email && (
        <a
          href={`mailto:${email}`}
          className="rounded-lg bg-white px-4 py-2 text-sm font-medium text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50"
        >
          Gửi email
        </a>
      )}
    </div>
  );
}
