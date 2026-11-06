"use client";

import { useEffect, useRef, useState } from "react";
import "pannellum/build/pannellum.css";
import type { PanoramaRoom } from "@/lib/api";

interface PannellumViewer {
  loadScene(id: string): void;
  on(event: "scenechange", cb: (id: string) => void): void;
  destroy(): void;
}

declare global {
  interface Window {
    pannellum?: { viewer(el: HTMLElement, config: object): PannellumViewer };
  }
}

// Mỗi phòng là một "scene" của Pannellum, id theo thứ tự trong danh sách
const sceneId = (i: number) => `p${i}`;

// Xem ảnh 360° (equirectangular 2:1) theo từng phòng; khách kéo chuột hoặc vuốt để nhìn quanh
export default function Panorama360({ rooms, className = "" }: { rooms: PanoramaRoom[]; className?: string }) {
  const box = useRef<HTMLDivElement>(null);
  const viewer = useRef<PannellumViewer | null>(null);
  const [current, setCurrent] = useState(sceneId(0));

  useEffect(() => {
    let cancelled = false;
    // Pannellum gắn vào window nên chỉ nạp ở trình duyệt
    import("pannellum/build/pannellum.js").then(() => {
      if (cancelled || !box.current || !window.pannellum || rooms.length === 0) return;
      setCurrent(sceneId(0));
      viewer.current = window.pannellum.viewer(box.current, {
        default: {
          firstScene: sceneId(0),
          autoLoad: true,
          // Không tự xoay khi người dùng bật "giảm chuyển động" trong hệ điều hành
          autoRotate: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : -2,
          sceneFadeDuration: 600,
          compass: false,
          strings: {
            loadingLabel: "Đang tải ảnh 360°...",
            // Link hỏng hoặc máy chủ ảnh không cho web khác tải (CORS)
            fileAccessError: "Không tải được ảnh 360° của phòng này.",
            malformedURLError: "Link ảnh 360° không hợp lệ.",
            genericWebGLError: "Trình duyệt không hỗ trợ xem 360°.",
          },
        },
        scenes: Object.fromEntries(
          // Không đặt title: tên phòng đã hiện ở hàng nút bên dưới
          rooms.map((r, i) => [sceneId(i), { type: "equirectangular", panorama: r.url, hfov: 100 }]),
        ),
      });
      viewer.current.on("scenechange", setCurrent);
    });
    return () => {
      cancelled = true;
      viewer.current?.destroy();
      viewer.current = null;
    };
  }, [rooms]);

  return (
    <div className={`relative overflow-hidden bg-slate-900 ${className}`}>
      <div ref={box} className="absolute inset-0" />
      {rooms.length === 1 && (
        <span className="absolute bottom-3 left-1/2 z-10 -translate-x-1/2 rounded-full bg-black/45 px-3 py-1.5 text-xs font-medium text-white backdrop-blur">
          {rooms[0].title}
        </span>
      )}
      {rooms.length > 1 && (
        <div className="absolute inset-x-0 bottom-3 z-10 flex flex-wrap justify-center gap-2 px-3">
          {rooms.map((r, i) => (
            <button
              key={sceneId(i)}
              type="button"
              aria-pressed={current === sceneId(i)}
              onClick={() => viewer.current?.loadScene(sceneId(i))}
              className={`rounded-full px-3 py-1.5 text-xs font-medium backdrop-blur transition ${
                current === sceneId(i) ? "bg-white text-slate-900" : "bg-black/45 text-white hover:bg-black/60"
              }`}
            >
              {r.title}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
