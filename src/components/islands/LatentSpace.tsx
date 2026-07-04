import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Latent diffusion, made concrete. A VAE encoder squeezes a 512×512×3 pixel
 *  image (786,432 numbers) down to a 64×64×4 latent (16,384 numbers, ~48×
 *  smaller). Diffusion runs entirely in that tiny latent space; a VAE decoder
 *  blows it back up to pixels. Animating the encode/decode makes the
 *  compression tangible. */

// Grid resolutions used only for the *illustration* — kept small so the SVG
// stays crisp. The real numbers (512/64) live in the shape labels below.
const PIXELS = 24; // pixel-image grid is PIXELS × PIXELS
const LATENT = 8; // latent grid is LATENT × LATENT

// --- Real tensor shapes (Stable Diffusion 1.x / SDXL) ---------------------
const PX_W = 512;
const PX_H = 512;
const PX_C = 3;
const LT_W = 64;
const LT_H = 64;
const LT_C = 4;

const PX_NUMBERS = PX_W * PX_H * PX_C; // 786,432
const LT_NUMBERS = LT_W * LT_H * LT_C; // 16,384
const RATIO = PX_NUMBERS / LT_NUMBERS; // ~48×

const fmt = (n: number) => n.toLocaleString("en-US");

// A procedural sky-with-sun scene so the pixel grids read as "an image".
// u, v are normalized 0..1 across the grid. Returns an rgb() string.
function scenePixel(u: number, v: number): string {
  // Sky gradient: warm near the horizon, deep blue up top.
  const topR = 40;
  const topG = 92;
  const topB = 196;
  const botR = 168;
  const botG = 206;
  const botB = 236;
  let r = Math.round(topR + (botR - topR) * v);
  let g = Math.round(topG + (botG - topG) * v);
  let b = Math.round(topB + (botB - topB) * v);

  // Sun: soft radial glow toward the upper-right.
  const sunU = 0.72;
  const sunV = 0.28;
  const d = Math.hypot(u - sunU, v - sunV);
  const glow = Math.max(0, 1 - d / 0.34);
  const core = Math.max(0, 1 - d / 0.13);
  const sunAmt = Math.min(1, glow * 0.55 + core * 1.1);
  r = Math.round(r + (255 - r) * sunAmt);
  g = Math.round(g + (232 - g) * sunAmt);
  b = Math.round(b + (150 - b) * sunAmt);

  return `rgb(${r}, ${g}, ${b})`;
}

type Cell = { x: number; y: number; fill: string };

function buildScene(n: number): Cell[] {
  const cells: Cell[] = [];
  for (let y = 0; y < n; y++) {
    for (let x = 0; x < n; x++) {
      const u = (x + 0.5) / n;
      const v = (y + 0.5) / n;
      cells.push({ x, y, fill: scenePixel(u, v) });
    }
  }
  return cells;
}

// A pseudo-random amber latent field. Uses an INTEGER hash (not Math.sin, whose
// last ULPs differ between Node SSR and the browser and cause hydration
// mismatches). Integer ops are bit-identical across engines. Values in [0,1].
function buildLatent(n: number): number[] {
  const out: number[] = [];
  for (let i = 0; i < n * n; i++) {
    let x = (i * 2654435761) >>> 0;
    x ^= x >>> 15;
    x = (x * 2246822519) >>> 0;
    x ^= x >>> 13;
    out.push((x >>> 0) / 4294967295);
  }
  return out;
}

export default function LatentSpace() {
  // "encoded" = latent view (denoising loop lives here); false = pixel view.
  const [encoded, setEncoded] = useState(false);
  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const scene = useMemo(() => buildScene(PIXELS), []);
  const latent = useMemo(() => buildLatent(LATENT), []);

  // --- SVG layout (viewBox units) ------------------------------------------
  const VB_W = 720;
  const VB_H = 300;
  const panel = 200; // each pixel panel is panel × panel
  const latentPx = 116; // latent panel is smaller, to feel compressed
  const leftX = 8;
  const rightX = VB_W - panel - 8;
  const midX = (VB_W - latentPx) / 2;
  const panelY = 40;
  const latentY = panelY + (panel - latentPx) / 2;

  const pxCell = panel / PIXELS;
  const ltCell = latentPx / LATENT;

  // Encode animation: pixel image collapses toward the latent (scale + slide).
  // Decode: the reverse. When reduced-motion is on we snap to the end state.
  const t = encoded ? 1 : 0;
  const dur = reduce ? "0ms" : "700ms";
  const ease = "cubic-bezier(0.65, 0, 0.35, 1)";

  const readout = encoded
    ? `Encoded to latent: ${LT_W}×${LT_H}×${LT_C} = ${fmt(LT_NUMBERS)} numbers.`
    : `Pixel image: ${PX_W}×${PX_H}×${PX_C} = ${fmt(PX_NUMBERS)} numbers.`;

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Shape labels — the headline of the whole thing */}
      <div className="grid grid-cols-3 items-center gap-2 text-center">
        <div className="rounded-lg bg-[var(--color-surface-2)] px-2 py-2">
          <p className="font-mono text-xs text-[var(--color-data-400)]">pixels</p>
          <p className="font-mono text-sm text-[var(--color-fg)]">
            {PX_W}×{PX_H}×{PX_C}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
            {fmt(PX_NUMBERS)} numbers
          </p>
        </div>
        <div className="flex flex-col items-center justify-center">
          <span className="font-mono text-lg text-[var(--color-shared-400)]" aria-hidden="true">
            →
          </span>
          <span className="rounded-full bg-[var(--color-shared-500)] px-2 py-0.5 font-mono text-xs font-semibold text-white">
            ~{Math.round(RATIO)}× smaller
          </span>
        </div>
        <div className="rounded-lg bg-[var(--color-surface-2)] px-2 py-2">
          <p className="font-mono text-xs text-[var(--color-weight-400)]">latent</p>
          <p className="font-mono text-sm text-[var(--color-fg)]">
            {LT_W}×{LT_H}×{LT_C}
          </p>
          <p className="font-mono text-[11px] tabular-nums text-[var(--color-muted)]">
            {fmt(LT_NUMBERS)} numbers
          </p>
        </div>
      </div>

      {/* Encode/decode diagram */}
      <div className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-2">
        <svg
          viewBox={`0 0 ${VB_W} ${VB_H}`}
          className="w-full"
          role="img"
          aria-label={`Variational autoencoder compressing a ${PX_W} by ${PX_H} pixel image into a ${LT_W} by ${LT_H} by ${LT_C} latent grid and decoding it back to pixels`}
        >
          {/* Encoder / decoder trapezoids connecting pixels <-> latent */}
          <polygon
            points={`${leftX + panel},${panelY} ${midX},${latentY} ${midX},${latentY + latentPx} ${leftX + panel},${panelY + panel}`}
            fill="var(--color-surface-2)"
            stroke="var(--color-line)"
            strokeWidth={1}
            opacity={encoded ? 1 : 0.55}
            style={{ transition: `opacity ${dur} ${ease}` }}
          />
          <polygon
            points={`${rightX},${panelY} ${midX + latentPx},${latentY} ${midX + latentPx},${latentY + latentPx} ${rightX},${panelY + panel}`}
            fill="var(--color-surface-2)"
            stroke="var(--color-line)"
            strokeWidth={1}
            opacity={encoded ? 0.55 : 1}
            style={{ transition: `opacity ${dur} ${ease}` }}
          />
          <text
            x={(leftX + panel + midX) / 2}
            y={VB_H - 8}
            textAnchor="middle"
            className="fill-[var(--color-muted)] font-mono"
            fontSize="11"
          >
            encoder
          </text>
          <text
            x={(rightX + midX + latentPx) / 2}
            y={VB_H - 8}
            textAnchor="middle"
            className="fill-[var(--color-muted)] font-mono"
            fontSize="11"
          >
            decoder
          </text>

          {/* LEFT: source pixel image. Shrinks + fades toward latent on encode. */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: `translate(${t * ((midX + latentPx / 2) - (leftX + panel / 2))}px, ${t * (latentY + latentPx / 2 - (panelY + panel / 2))}px) scale(${1 - t * 0.55})`,
              opacity: 1 - t,
              transition: `transform ${dur} ${ease}, opacity ${dur} ${ease}`,
            }}
          >
            <rect
              x={leftX}
              y={panelY}
              width={panel}
              height={panel}
              rx={6}
              fill="none"
              stroke="var(--color-data-500)"
              strokeWidth={1.5}
            />
            {scene.map((c) => (
              <rect
                key={`pl-${c.x}-${c.y}`}
                x={leftX + c.x * pxCell}
                y={panelY + c.y * pxCell}
                width={pxCell + 0.5}
                height={pxCell + 0.5}
                fill={c.fill}
              />
            ))}
          </g>

          {/* MIDDLE: the latent grid — where the denoising loop actually runs. */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: `scale(${0.82 + t * 0.18})`,
              transition: `transform ${dur} ${ease}`,
            }}
          >
            <rect
              x={midX - 4}
              y={latentY - 4}
              width={latentPx + 8}
              height={latentPx + 8}
              rx={6}
              fill="var(--color-surface)"
              stroke="var(--color-weight-500)"
              strokeWidth={encoded ? 2 : 1}
              style={{ transition: `stroke-width ${dur} ${ease}` }}
            />
            {latent.map((val, i) => {
              const gx = i % LATENT;
              const gy = Math.floor(i / LATENT);
              // Blend amber-400 -> amber-500 by value for a little texture.
              return (
                <rect
                  key={`lt-${i}`}
                  x={midX + gx * ltCell + 0.75}
                  y={latentY + gy * ltCell + 0.75}
                  width={ltCell - 1.5}
                  height={ltCell - 1.5}
                  rx={1.5}
                  fill={val > 0.5 ? "var(--color-weight-500)" : "var(--color-weight-400)"}
                  opacity={0.55 + val * 0.45}
                />
              );
            })}
          </g>

          {/* RIGHT: decoded pixel image. Grows in from the latent on decode. */}
          <g
            style={{
              transformBox: "fill-box",
              transformOrigin: "center",
              transform: `translate(${t * 0}px, 0px) scale(${0.45 + t * 0.55})`,
              opacity: t,
              transition: `transform ${dur} ${ease}, opacity ${dur} ${ease}`,
            }}
          >
            <rect
              x={rightX}
              y={panelY}
              width={panel}
              height={panel}
              rx={6}
              fill="none"
              stroke="var(--color-data-500)"
              strokeWidth={1.5}
            />
            {scene.map((c) => (
              <rect
                key={`pr-${c.x}-${c.y}`}
                x={rightX + c.x * pxCell}
                y={panelY + c.y * pxCell}
                width={pxCell + 0.5}
                height={pxCell + 0.5}
                fill={c.fill}
              />
            ))}
          </g>

          {/* Loop badge over the latent when encoded */}
          <g
            style={{
              opacity: encoded ? 1 : 0,
              transition: `opacity ${dur} ${ease}`,
            }}
          >
            <text
              x={midX + latentPx / 2}
              y={latentY - 12}
              textAnchor="middle"
              className="fill-[var(--color-unique-400)] font-mono"
              fontSize="11"
            >
              ↻ denoising loop runs here
            </text>
          </g>
        </svg>
      </div>

      {/* Controls + live readout */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)]">
          <button
            type="button"
            onClick={() => setEncoded(false)}
            aria-pressed={!encoded}
            className={
              "px-4 py-2 text-sm font-semibold transition-colors " +
              (!encoded
                ? "bg-[var(--color-data-500)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
            }
          >
            ← Decode to pixels
          </button>
          <button
            type="button"
            onClick={() => setEncoded(true)}
            aria-pressed={encoded}
            className={
              "px-4 py-2 text-sm font-semibold transition-colors " +
              (encoded
                ? "bg-[var(--color-weight-500)] text-white"
                : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
            }
          >
            Encode to latent →
          </button>
        </div>
        <p className="font-mono text-xs tabular-nums text-[var(--color-fg)]" aria-live="polite">
          {readout}
        </p>
      </div>

      <p className="text-sm text-[var(--color-muted)]">
        The entire denoising loop runs in this tiny latent space — then a VAE
        decoder blows it back up to pixels. That compression is the core speed
        trick of latent diffusion (Stable Diffusion).{" "}
        <span className="text-[var(--color-unique-400)]">
          SD3 and FLUX use a richer 16-channel latent for finer detail.
        </span>
      </p>
    </div>
  );
}
