"use client";

import { useEffect, useImperativeHandle, useRef, useState, type Ref } from "react";

export interface SignaturePadHandle {
  clear: () => void;
  // Ảnh PNG dạng data URL, hoặc null nếu khách chưa vẽ gì
  toDataUrl: () => string | null;
}

const WIDTH = 500;
const HEIGHT = 160;

// Ô vẽ chữ ký bằng chuột hoặc ngón tay
export default function SignaturePad({ ref }: { ref?: Ref<SignaturePadHandle> }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    ctx.lineWidth = 2.5;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f172a";
  }, []);

  useImperativeHandle(ref, () => ({
    clear() {
      const canvas = canvasRef.current;
      canvas?.getContext("2d")?.clearRect(0, 0, WIDTH, HEIGHT);
      setHasInk(false);
    },
    toDataUrl() {
      return hasInk ? (canvasRef.current?.toDataURL("image/png") ?? null) : null;
    },
  }));

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: ((e.clientX - rect.left) / rect.width) * WIDTH, y: ((e.clientY - rect.top) / rect.height) * HEIGHT };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    e.currentTarget.setPointerCapture(e.pointerId);
    drawing.current = true;
    const { x, y } = point(e);
    ctx.beginPath();
    ctx.moveTo(x, y);
    // chấm một điểm để cú chạm nhẹ cũng thành nét
    ctx.lineTo(x + 0.01, y + 0.01);
    ctx.stroke();
    setHasInk(true);
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = canvasRef.current?.getContext("2d");
    if (!ctx) return;
    const { x, y } = point(e);
    ctx.lineTo(x, y);
    ctx.stroke();
  }

  function end() {
    drawing.current = false;
  }

  return (
    <canvas
      ref={canvasRef}
      width={WIDTH}
      height={HEIGHT}
      onPointerDown={start}
      onPointerMove={move}
      onPointerUp={end}
      onPointerCancel={end}
      aria-label="Ô vẽ chữ ký"
      className="h-40 w-full touch-none rounded-lg border border-dashed border-slate-400 bg-white"
    />
  );
}
