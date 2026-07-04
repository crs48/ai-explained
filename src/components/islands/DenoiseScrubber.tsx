import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Schematic denoising scrubber — teaches noise → image with NO diffusion model.
 *  A target "image" (an emoji drawn to a canvas) is progressively blended with a
 *  fixed noise field; the slider plays that in reverse as "denoising". The
 *  scheduler toggle changes step count (and leaves more residual noise at low
 *  step counts) to show the speed/quality tradeoff. Values are illustrative. */

const RES = 160;

const PROMPTS = [
  { label: "a sunset", emoji: "🌅" },
  { label: "a duck", emoji: "🦆" },
  { label: "a castle", emoji: "🏰" },
  { label: "a rocket", emoji: "🚀" },
];

const SCHEDULERS = {
  ddpm: { label: "DDPM", steps: 1000, floor: 0.0 },
  ddim: { label: "DDIM", steps: 50, floor: 0.04 },
  lcm: { label: "LCM", steps: 4, floor: 0.16 },
} as const;
type Scheduler = keyof typeof SCHEDULERS;

export default function DenoiseScrubber() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const targetRef = useRef<Uint8ClampedArray | null>(null);
  const noiseRef = useRef<Uint8ClampedArray | null>(null);
  const rafRef = useRef<number | undefined>(undefined);

  const [prompt, setPrompt] = useState(0);
  const [scheduler, setScheduler] = useState<Scheduler>("ddim");
  const [progress, setProgress] = useState(0); // 0 = pure noise, 1 = final image
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  // Build the fixed noise field once.
  useEffect(() => {
    const n = new Uint8ClampedArray(RES * RES * 4);
    for (let i = 0; i < RES * RES; i++) {
      n[i * 4] = Math.random() * 255;
      n[i * 4 + 1] = Math.random() * 255;
      n[i * 4 + 2] = Math.random() * 255;
      n[i * 4 + 3] = 255;
    }
    noiseRef.current = n;
  }, []);

  // Render the target emoji to an offscreen canvas and cache its pixels.
  useEffect(() => {
    const off = document.createElement("canvas");
    off.width = RES;
    off.height = RES;
    const ctx = off.getContext("2d");
    if (!ctx) return;
    const grad = ctx.createLinearGradient(0, 0, 0, RES);
    grad.addColorStop(0, "#1b2540");
    grad.addColorStop(1, "#0b1020");
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, RES, RES);
    ctx.font = `${Math.round(RES * 0.66)}px "Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif`;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(PROMPTS[prompt].emoji, RES / 2, RES / 2 + RES * 0.04);
    targetRef.current = ctx.getImageData(0, 0, RES, RES).data;
  }, [prompt]);

  // Draw the current frame whenever progress / scheduler / prompt changes.
  useEffect(() => {
    const canvas = canvasRef.current;
    const target = targetRef.current;
    const noise = noiseRef.current;
    if (!canvas || !target || !noise) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const floor = SCHEDULERS[scheduler].floor;
    // sigma: how much noise is mixed in. 1 at progress 0, `floor` at progress 1.
    const sigma = floor + (1 - floor) * (1 - progress);
    const out = ctx.createImageData(RES, RES);
    const d = out.data;
    for (let i = 0; i < d.length; i += 4) {
      d[i] = target[i] * (1 - sigma) + noise[i] * sigma;
      d[i + 1] = target[i + 1] * (1 - sigma) + noise[i + 1] * sigma;
      d[i + 2] = target[i + 2] * (1 - sigma) + noise[i + 2] * sigma;
      d[i + 3] = 255;
    }
    ctx.putImageData(out, 0, 0);
  }, [progress, scheduler, prompt]);

  function play() {
    window.cancelAnimationFrame(rafRef.current ?? 0);
    if (reduce) {
      setProgress(1);
      return;
    }
    const start = performance.now();
    const dur = 2400;
    const tick = (now: number) => {
      const p = Math.min((now - start) / dur, 1);
      setProgress(p);
      if (p < 1) rafRef.current = window.requestAnimationFrame(tick);
    };
    setProgress(0);
    rafRef.current = window.requestAnimationFrame(tick);
  }

  useEffect(() => () => window.cancelAnimationFrame(rafRef.current ?? 0), []);

  const steps = SCHEDULERS[scheduler].steps;
  const pct = Math.round(progress * 100);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prompt">
        {PROMPTS.map((p, i) => (
          <button
            key={p.label}
            type="button"
            onClick={() => setPrompt(i)}
            aria-pressed={prompt === i}
            className={
              "rounded-md px-2.5 py-1 text-xs " +
              (prompt === i
                ? "bg-[var(--color-unique-500)] text-white"
                : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
            }
          >
            {p.emoji} {p.label}
          </button>
        ))}
      </div>

      <div className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={RES}
          height={RES}
          className="w-full max-w-[280px] rounded-xl border border-[var(--color-line)]"
          style={{ aspectRatio: "1 / 1", imageRendering: "auto" }}
          role="img"
          aria-label={`Denoising ${PROMPTS[prompt].label}: ${pct}% denoised`}
        />
      </div>

      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>← noise · denoising · image →</span>
          <span className="font-mono text-[var(--color-fg)]">{pct}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          aria-label="Denoising progress"
          suppressHydrationWarning
          className="mt-1 w-full accent-[var(--color-unique-500)]"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {(Object.keys(SCHEDULERS) as Scheduler[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setScheduler(k)}
              aria-pressed={scheduler === k}
              className={
                "px-2.5 py-1 " +
                (scheduler === k
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {SCHEDULERS[k].label}
            </button>
          ))}
        </div>
        <span className="font-mono text-xs text-[var(--color-muted)]">{steps} steps</span>
        <button
          type="button"
          onClick={play}
          className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          Denoise ▶
        </button>
      </div>
      <p className="text-xs text-[var(--color-muted)]">
        Start from pure noise; each step removes a little to reveal the image. Fewer steps (LCM) is
        far faster but leaves it rougher. (Schematic — a real model denoises a learned latent, not an
        emoji.)
      </p>
    </div>
  );
}
