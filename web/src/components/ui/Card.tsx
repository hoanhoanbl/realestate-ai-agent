import type { HTMLAttributes } from "react";

interface CardProps extends HTMLAttributes<HTMLDivElement> {
  padded?: boolean;
}

export const CARD = "rounded-xl border border-slate-200 bg-white shadow-card";

export default function Card({ padded = true, className = "", ...rest }: CardProps) {
  return <div className={`${CARD} ${padded ? "p-5" : ""} ${className}`} {...rest} />;
}
