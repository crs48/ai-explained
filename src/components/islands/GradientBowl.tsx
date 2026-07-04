import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";
import { bowlGrad, bowlLoss } from "../../lib/tinynet";

/** The TRUE loss surface of a 2-parameter neuron (sigmoid(w·x+b) on 12 fixed
 *  points), painted over (w, b) ∈ [-4,4]². Click to drop the ball; it takes
 *  real gradient steps at the chosen learning rate. Convergence AND
 *  divergence are genuine — nothing here is staged. */

const SIZE = 320;
const RES = 110;
const DOM = 4; // w, b ∈ [-DOM, DOM]
const MAX_STEPS = 600;

type Ball = { w: number; b: number; path: [number, number][]; steps: number };

function toPx(v: number): number {
  return ((v + DOM) / (2 * DOM)) * SIZE;
}
function fromPx(p: number): number {
  return (p / SIZE) * 2 * DOM - DOM;
}

export default function GradientBowl() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const baseRef = useRef<HTMLCanvasElement | null>(null); // cached heatmap
  const rafRef = useRef<number | undefined>(undefined);
  const ballRef = useRef<Ball | null>(null);

  const [lr, setLr] = useState(1.5);
  const lrRef = useRef(lr);
  lrRef.current = lr;
  const [reduce, setReduce] = useState(false);
  const [running, setRunning] = useState(false);
  const [readout, setReadout] = useState<{ loss: number; steps: number; status: string } | null>(
    null,
  );

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  // Paint the true loss surface once, cache it offscreen.
  useEffect(() => {
    const grid = new Float32Array(RES * RES);
    let lo = Infinity;
    let hi = -Infinity;
    for (let gy = 0; gy < RES; gy++) {
      for (let gx = 0; gx < RES; gx++) {
        const w = (gx / (RES - 1)) * 2 * DOM - DOM;
        const b = DOM - (gy / (RES - 1)) * 2 * DOM;
        const L = bowlLoss(w, b);
        grid[gy * RES + gx] = L;
        if (L < lo) lo = L;
        if (L > hi) hi = L;
      }
    }
    const img = new ImageData(RES, RES);
    for (let i = 0; i < RES * RES; i++) {
      let t = (grid[i] - lo) / (hi - lo);
      t = Math.pow(t, 0.5);
      // Valley = dark surface blue-black; ridge = amber. Faint contour bands.
      const band = Math.abs(((t * 9) % 1) - 0.5) < 0.06 ? 0.85 : 1;
      const r = (18 + (245 - 18) * t) * band;
      const g = (26 + (166 - 26) * t) * band;
      const bl = (46 + (35 - 46) * t) * band;
      img.data[i * 4] = r;
      img.data[i * 4 + 1] = g;
      img.data[i * 4 + 2] = bl;
      img.data[i * 4 + 3] = 255;
    }
    const off = document.createElement("canvas");
    off.width = RES;
    off.height = RES;
    off.getContext("2d")?.putImageData(img, 0, 0);
    baseRef.current = off;
    draw();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    const base = baseRef.current;
    if (!canvas || !base) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(base, 0, 0, SIZE, SIZE);
    const ball = ballRef.current;
    if (!ball) return;
    if (ball.path.length > 1) {
      ctx.beginPath();
      ctx.moveTo(toPx(ball.path[0][0]), SIZE - toPx(ball.path[0][1]));
      for (const [w, b] of ball.path) ctx.lineTo(toPx(w), SIZE - toPx(b));
      ctx.strokeStyle = "#ff6bb3";
      ctx.lineWidth = 1.5;
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(toPx(ball.w), SIZE - toPx(ball.b), 5.5, 0, 2 * Math.PI);
    ctx.fillStyle = "#e8ecf7";
    ctx.fill();
    ctx.strokeStyle = "#0b1020";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  /** One true gradient-descent step. Returns false when it should stop. */
  function stepOnce(): boolean {
    const ball = ballRef.current;
    if (!ball) return false;
    const [gw, gb] = bowlGrad(ball.w, ball.b);
    const gnorm = Math.hypot(gw, gb);
    ball.w -= lrRef.current * gw;
    ball.b -= lrRef.current * gb;
    ball.steps++;
    ball.path.push([ball.w, ball.b]);
    if (ball.path.length > 400) ball.path.shift();
    const out = Math.abs(ball.w) > DOM * 2.5 || Math.abs(ball.b) > DOM * 2.5;
    const settled = gnorm < 1e-3;
    updateReadout(out ? "☄️ launched out of the bowl — learning rate too high" : settled ? "settled in the valley" : "rolling…");
    return !out && !settled && ball.steps < MAX_STEPS;
  }

  function updateReadout(status: string) {
    const ball = ballRef.current;
    if (!ball) return;
    setReadout({ loss: bowlLoss(ball.w, ball.b), steps: ball.steps, status });
  }

  function stopLoop() {
    window.cancelAnimationFrame(rafRef.current ?? 0);
    setRunning(false);
  }

  function startLoop() {
    stopLoop();
    setRunning(true);
    const tick = () => {
      const more = stepOnce();
      draw();
      if (more) rafRef.current = window.requestAnimationFrame(tick);
      else setRunning(false);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }

  function drop(w: number, b: number) {
    stopLoop();
    ballRef.current = { w, b, path: [[w, b]], steps: 0 };
    updateReadout(reduce ? "dropped — use the step buttons" : "rolling…");
    draw();
    if (!reduce) startLoop();
  }

  function manualSteps(n: number) {
    if (!ballRef.current) return;
    stopLoop();
    for (let i = 0; i < n; i++) if (!stepOnce()) break;
    draw();
  }

  useEffect(() => () => window.cancelAnimationFrame(rafRef.current ?? 0), []);

  function onCanvasClick(e: React.MouseEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    const w = fromPx(((e.clientX - rect.left) / rect.width) * SIZE);
    const b = -fromPx(((e.clientY - rect.top) / rect.height) * SIZE);
    drop(w, b);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <div className="relative w-full max-w-[300px]">
          <canvas
            ref={canvasRef}
            width={SIZE}
            height={SIZE}
            onClick={onCanvasClick}
            className="w-full cursor-crosshair rounded-xl border border-[var(--color-line)]"
            style={{ aspectRatio: "1 / 1" }}
            role="img"
            aria-label="The true loss surface over the neuron's two parameters. Click to drop a ball and run gradient descent."
          />
          <span className="pointer-events-none absolute bottom-1.5 right-2 font-mono text-[10px] text-[var(--color-muted)]">
            w →
          </span>
          <span className="pointer-events-none absolute left-2 top-1.5 font-mono text-[10px] text-[var(--color-muted)]">
            b ↑
          </span>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-data-400)]">
            {readout ? readout.loss.toFixed(3) : "—"}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">loss here</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-fg)]">
            {readout ? readout.steps : "—"}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">steps taken</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="text-xs leading-5 text-[var(--color-fg)]">
            {readout ? readout.status : "click the surface"}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">status</div>
        </div>
      </div>

      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>learning rate (step size)</span>
          <span className="font-mono text-[var(--color-fg)]">{lr.toFixed(1)}</span>
        </span>
        <input
          type="range"
          min={0.1}
          max={10}
          step={0.1}
          value={lr}
          onChange={(e) => setLr(Number(e.target.value))}
          aria-label="Learning rate"
          suppressHydrationWarning
          className="mt-1 w-full accent-[var(--color-unique-500)]"
        />
      </label>

      <div className="flex flex-wrap items-center gap-2">
        <button
          type="button"
          onClick={() => manualSteps(1)}
          className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
        >
          step ×1
        </button>
        <button
          type="button"
          onClick={() => manualSteps(25)}
          className="rounded-lg border border-[var(--color-line)] px-2.5 py-1 text-xs text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
        >
          step ×25
        </button>
        {!reduce && (
          <button
            type="button"
            onClick={() => (running ? stopLoop() : ballRef.current && startLoop())}
            className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1 text-xs font-semibold text-white hover:brightness-110"
          >
            {running ? "pause" : "roll ▶"}
          </button>
        )}
        <span className="ml-auto text-[10px] text-[var(--color-muted)]">
          dark valley = low loss · amber ridge = high
        </span>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        This surface is computed live from the neuron's actual loss — try a low learning rate from a
        far corner, then crank it past ~3 and watch the ball overshoot the valley for real.
      </p>
    </div>
  );
}
