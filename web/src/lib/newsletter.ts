// Chỉ dùng địa chỉ công khai; không dùng URL API hoặc credential Mautic.
export function newsletterFormUrl(baseUrl: string | undefined, formId: string | undefined): string | null {
  if (!baseUrl || !formId || !/^[1-9]\d*$/.test(formId)) return null;
  try {
    const base = new URL(baseUrl);
    const local = ["localhost", "127.0.0.1", "[::1]"].includes(base.hostname);
    if (base.protocol !== "https:" && !(base.protocol === "http:" && local)) return null;
    if (base.username || base.password || base.search || base.hash) return null;
    if (base.pathname !== "/") return null;
    return new URL(`/form/${formId}`, base).href;
  } catch {
    return null;
  }
}

export const NEWSLETTER_FORM_URL = newsletterFormUrl(
  process.env.NEXT_PUBLIC_MAUTIC_URL,
  process.env.NEXT_PUBLIC_MAUTIC_NEWSLETTER_FORM_ID,
);
