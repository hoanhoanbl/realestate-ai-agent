// Bộ icon nét mảnh tự vẽ (không cần cài thư viện). Dùng: <Icon name="users" className="h-5 w-5" />
const PATHS = {
  dashboard: "M4 13h6V4H4v9Zm0 7h6v-4H4v4Zm10 0h6v-9h-6v9Zm0-16v4h6V4h-6Z",
  users: "M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1M9.5 10a3 3 0 1 0 0-6 3 3 0 0 0 0 6ZM21 19v-1a4 4 0 0 0-3-3.9M15.5 4.1a3 3 0 0 1 0 5.8",
  calendar: "M7 3v3M17 3v3M4 9h16M5 5h14a1 1 0 0 1 1 1v13a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1Zm3 8h2m3 0h2m-7 3h2m3 0h2",
  contract: "M14 3H6a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1V8l-5-5Zm0 0v5h5M9 13h6M9 17h4",
  chart: "M4 20V10m6 10V4m6 16v-7m4 7H3",
  home: "M3 11 12 4l9 7M5 9.5V20h14V9.5M10 20v-5h4v5",
  shield: "M12 3 4 6v6c0 4.5 3.4 8.3 8 9 4.6-.7 8-4.5 8-9V6l-8-3Zm-3 9 2 2 4-4",
  menu: "M4 6h16M4 12h16M4 18h16",
  close: "M6 6l12 12M18 6 6 18",
  logout: "M15 4h3a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1h-3M10 16l4-4-4-4M14 12H4",
  search: "M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm9 3-4.5-4.5",
  clock: "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18Zm0-13v4l3 2",
  check: "M5 12.5 10 17 19 7",
  alert: "M12 9v4m0 3.5v.5M10.3 4.2 2.5 18a2 2 0 0 0 1.7 3h15.6a2 2 0 0 0 1.7-3L13.7 4.2a2 2 0 0 0-3.4 0Z",
  fire: "M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.3 1.6 1.2 2.7 2.5 3.2C11 7.8 12.6 5 15 3c0 3 4 5.5 4 11.5 0 3.8-3 6.5-7 6.5Z",
  printer: "M7 8V3h10v5M7 17H5a1 1 0 0 1-1-1v-6a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v6a1 1 0 0 1-1 1h-2M7 14h10v7H7v-7Z",
  arrowRight: "M5 12h14m-5-5 5 5-5 5",
  sparkles: "M12 3v4m0 10v4M3 12h4m10 0h4M6 6l2.5 2.5m7 7L18 18M6 18l2.5-2.5m7-7L18 6",
  // Trang chi tiết nhà (FE-31)
  chevronLeft: "M15 5l-7 7 7 7",
  chevronRight: "M9 5l7 7-7 7",
  bed: "M3 18v-7a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2v7M3 15h18M3 18v2m18-2v2M6 9V6a1 1 0 0 1 1-1h10a1 1 0 0 1 1 1v3",
  bath: "M4 12h16v2a5 5 0 0 1-5 5H9a5 5 0 0 1-5-5v-2Zm2 0V6a2 2 0 0 1 4 0M7 19l-1 2m11-2 1 2",
  area: "M4 9V4h5M20 9V4h-5M4 15v5h5M20 15v5h-5",
  pin: "M12 21s-7-6.2-7-11.5a7 7 0 0 1 14 0C19 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z",
  school: "M3 9l9-5 9 5-9 5-9-5Zm4 2.5V16c0 1.5 2.2 3 5 3s5-1.5 5-3v-4.5M21 9v6",
  hospital: "M5 21V5a1 1 0 0 1 1-1h12a1 1 0 0 1 1 1v16M3 21h18M12 7v6m-3-3h6M10 21v-4h4v4",
  market: "M3 4h2l2.2 10.5a1 1 0 0 0 1 .8h9.3a1 1 0 0 0 1-.8L20 8H6M9 20a1 1 0 1 0 0-.01M17 20a1 1 0 1 0 0-.01",
  mall: "M6 8h12l1 12H5L6 8Zm3 0V6a3 3 0 0 1 6 0v2",
  park: "M12 21v-6m0 0c-3.3 0-6-2.2-6-5 0-2.5 2-4.2 3-5.2C9.8 3.6 11 3 12 3s2.2.6 3 1.8c1 1 3 2.7 3 5.2 0 2.8-2.7 5-6 5Z",
  transport: "M6 4h12a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2Zm-2 7h16M8 17l-2 3m10-3 2 3M8 14h.01M16 14h.01",
  // Thay emoji/ký tự làm icon (FE-26, skill ui-ux-pro-max: no-emoji-icons)
  arrowLeft: "M19 12H5m5-5-5 5 5 5",
  externalLink: "M14 4h6v6m0-6-9 9M18 14v5a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5",
  flame: "M12 21c-4 0-7-2.7-7-6.5 0-3 2-5 3.5-6.5.3 1.6 1.2 2.7 2.5 3.2C11 7.8 12.6 5 15 3c0 3 4 5.5 4 11.5 0 3.8-3 6.5-7 6.5Z",
  rocket: "M5 15c-1 1-1.5 3.5-1.5 5.5 2 0 4.5-.5 5.5-1.5M9 15l-3-3c1.5-4.5 5.5-9 13-9 0 7.5-4.5 11.5-9 13l-1-1Zm6-6.5a1.5 1.5 0 1 0 0-.01",
  star: "M12 3.5l2.6 5.3 5.9.9-4.3 4.1 1 5.8L12 16.9l-5.2 2.7 1-5.8L3.5 9.7l5.9-.9L12 3.5Z",
  rotate360: "M21 12a9 9 0 1 1-3-6.7M21 4v5h-5M12 8v4l2.5 1.5",
  plus: "M12 5v14M5 12h14",
  mail: "M4 6h16a1 1 0 0 1 1 1v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1Zm0 1 8 6 8-6",
  arrowUp: "M12 19V5m-6 6 6-6 6 6",
  eye: "M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12Zm9.5 3a3 3 0 1 0 0-6 3 3 0 0 0 0 6Z",
  eyeOff: "M3 3l18 18M10.6 6.1A9.7 9.7 0 0 1 12 6c6 0 9.5 6 9.5 6a17 17 0 0 1-2.8 3.4M6.6 7.4C3.9 9.2 2.5 12 2.5 12S6 18 12 18c1.6 0 3-.4 4.2-1M9.9 9.9a3 3 0 0 0 4.2 4.2",
} as const;

export type IconName = keyof typeof PATHS;

// filled: tô kín (dùng cho sao chấm điểm đã chọn)
export default function Icon({ name, className = "h-5 w-5", filled = false }: { name: IconName; className?: string; filled?: boolean }) {
  return (
    <svg viewBox="0 0 24 24" className={className} fill={filled ? "currentColor" : "none"} stroke="currentColor" strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d={PATHS[name]} />
    </svg>
  );
}
