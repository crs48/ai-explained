/** Canvas helpers shared by the foundations islands: paint a model's decision
 *  surface over the [-1,1]² domain (TF-Playground's evaluate-on-a-grid trick)
 *  and scatter labeled points on top. Class 1 = data blue, class 0 = weight
 *  amber, blended toward the panel surface by confidence. */

import type { Pt } from "./tinynet";

const BG: [number, number, number] = [18, 26, 46]; // --color-surface
const C1: [number, number, number] = [47, 127, 240]; // --color-data-500
const C0: [number, number, number] = [245, 166, 35]; // --color-weight-500

/** Evaluate `f(x, y) → P(class 1)` over a res×res grid and draw it, upscaled
 *  and smoothed, to fill the canvas. ~res² evals — keep res ≤ 100 in rAF. */
export function paintSurface(
  canvas: HTMLCanvasElement,
  f: (x: number, y: number) => number,
  res = 64,
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const img = new ImageData(res, res);
  const d = img.data;
  for (let gy = 0; gy < res; gy++) {
    const y = 1 - (gy / (res - 1)) * 2;
    for (let gx = 0; gx < res; gx++) {
      const x = (gx / (res - 1)) * 2 - 1;
      const p = f(x, y);
      const t = p * 2 - 1; // -1 (class 0) … 1 (class 1)
      const c = t > 0 ? C1 : C0;
      const a = Math.min(1, Math.abs(t)) * 0.6; // confidence → tint strength
      const i = (gy * res + gx) * 4;
      d[i] = BG[0] + (c[0] - BG[0]) * a;
      d[i + 1] = BG[1] + (c[1] - BG[1]) * a;
      d[i + 2] = BG[2] + (c[2] - BG[2]) * a;
      d[i + 3] = 255;
    }
  }
  const off = document.createElement("canvas");
  off.width = res;
  off.height = res;
  off.getContext("2d")?.putImageData(img, 0, 0);
  ctx.imageSmoothingEnabled = true;
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(off, 0, 0, canvas.width, canvas.height);
}

/** Scatter dataset points over the painted surface. `hollow` marks a subset
 *  (e.g. the test split) with outline-only dots. */
export function drawPoints(
  canvas: HTMLCanvasElement,
  pts: Pt[],
  opts: { hollow?: (p: Pt, i: number) => boolean } = {},
): void {
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  const { width: w, height: h } = canvas;
  const r = Math.max(2, Math.min(w, h) * 0.011);
  pts.forEach((p, i) => {
    const px = ((p.x + 1) / 2) * w;
    const py = ((1 - p.y) / 2) * h;
    ctx.beginPath();
    ctx.arc(px, py, r, 0, 2 * Math.PI);
    const color = p.label === 1 ? "#5aa9ff" : "#ffcb6b";
    if (opts.hollow?.(p, i)) {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.5;
      ctx.stroke();
    } else {
      ctx.fillStyle = color;
      ctx.fill();
      ctx.strokeStyle = "rgba(11,16,32,0.9)"; // --color-ink halo for contrast
      ctx.lineWidth = 1;
      ctx.stroke();
    }
  });
}
