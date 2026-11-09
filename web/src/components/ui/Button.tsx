import type { ButtonHTMLAttributes } from "react";

export type ButtonVariant = "primary" | "secondary" | "ghost" | "danger";
export type ButtonSize = "sm" | "md" | "lg";

const VARIANTS: Record<ButtonVariant, string> = {
  primary: "bg-brand-600 text-white hover:bg-brand-700 focus-visible:ring-brand-200",
  secondary: "bg-white text-slate-700 ring-1 ring-slate-300 hover:bg-slate-50 focus-visible:ring-brand-200",
  ghost: "text-slate-600 hover:bg-slate-100 focus-visible:ring-slate-200",
  danger: "bg-rose-600 text-white hover:bg-rose-700 focus-visible:ring-rose-200",
};

// Điện thoại: cao tối thiểu 44px cho dễ chạm (skill ui-ux-pro-max, touch-target-size); máy tính giữ cỡ gọn
const SIZES: Record<ButtonSize, string> = {
  sm: "min-h-11 px-3 py-1.5 text-sm sm:min-h-8",
  md: "min-h-11 px-4 py-2 text-sm sm:min-h-10",
  lg: "min-h-12 px-5 py-3 text-base",
};

// Dùng cho cả <button> và <Link>: <Link className={buttonClass("secondary")}>
export function buttonClass(variant: ButtonVariant = "primary", size: ButtonSize = "md", extra = ""): string {
  return [
    "inline-flex items-center justify-center gap-2 rounded-lg font-medium transition",
    "outline-none focus-visible:ring-4 disabled:cursor-not-allowed disabled:opacity-60",
    VARIANTS[variant],
    SIZES[size],
    extra,
  ].join(" ");
}

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

export default function Button({ variant = "primary", size = "md", className = "", type = "button", ...rest }: ButtonProps) {
  return <button type={type} className={buttonClass(variant, size, className)} {...rest} />;
}
