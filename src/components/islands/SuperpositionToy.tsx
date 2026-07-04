import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";
import { mulberry32 } from "../../lib/tinynet";

/** Anthropic's toy model of superposition, trained LIVE in the browser:
 *  5 sparse features → a 2-dimensional bottleneck → ReLU reconstruction,
 *  x̂ = ReLU(WᵀWx + b) with W ∈ ℝ²ˣ⁵ — 15 parameters. Move the sparsity
 *  slider and watch the feature directions W_i reorganize: dense data → the
 *  model keeps only 2 features (orthogonal); sparse data → it crams all 5
 *  into 2D as a pentagon. That reorganization IS superposition.
 *  Reference: transformer-circuits.pub/2022/toy_model. */

const N = 5; // features
const D = 2; // bottleneck dims
const BATCH = 128;
const STEPS_PER_FRAME = 60;
const TOTAL_STEPS = 2600;
const LR = 0.02;
const SIZE = 300;

const FEATURE_COLORS = ["#5aa9ff", "#37d9c3", "#ffcb6b", "#ff6bb3", "#b39dff"];

type Model = {
  w: Float64Array; // D×N, row-major
  b: Float64Array; // N
  m: Float64Array; // Adam moments
  v: Float64Array;
  t: number;
};

function initModel(seed: number): Model {
  const rand = mulberry32(seed);
  const w = new Float64Array(D * N);
  for (let i = 0; i < w.length; i++) w[i] = (rand() - 0.5) * 0.8;
  return { w, b: new Float64Array(N), m: new Float64Array(D * N + N), v: new Float64Array(D * N + N), t: 0 };
}

/** One Adam step on a fresh random batch. Returns mean reconstruction loss. */
function trainStep(model: Model, sparsity: number, rand: () => number): number {
  const { w, b } = model;
  const gw = new Float64Array(D * N);
  const gb = new Float64Array(N);
  let lossSum = 0;

  for (let s = 0; s < BATCH; s++) {
    const x = new Float64Array(N);
    for (let i = 0; i < N; i++) x[i] = rand() < 1 - sparsity ? rand() : 0;
    // h = Wx
    const h = new Float64Array(D);
    for (let a = 0; a < D; a++) {
      let acc = 0;
      for (let i = 0; i < N; i++) acc += w[a * N + i] * x[i];
      h[a] = acc;
    }
    // y = Wᵀh + b, x̂ = ReLU(y)
    const e = new Float64Array(N); // 2(x̂−x)·1[y>0]
    for (let i = 0; i < N; i++) {
      let y = b[i];
      for (let a = 0; a < D; a++) y += w[a * N + i] * h[a];
      const xh = Math.max(0, y);
      const diff = xh - x[i];
      lossSum += diff * diff;
      e[i] = y > 0 ? 2 * diff : 0;
      gb[i] += e[i];
    }
    // ∂L/∂W_{a,k} = e_k·h_a + (W e)_a·x_k
    for (let a = 0; a < D; a++) {
      let we = 0;
      for (let i = 0; i < N; i++) we += w[a * N + i] * e[i];
      for (let k = 0; k < N; k++) gw[a * N + k] += e[k] * h[a] + we * x[k];
    }
  }

  // Adam
  model.t++;
  const b1 = 0.9;
  const b2 = 0.999;
  const corr1 = 1 - Math.pow(b1, model.t);
  const corr2 = 1 - Math.pow(b2, model.t);
  const apply = (params: Float64Array, grads: Float64Array, off: number) => {
    for (let i = 0; i < params.length; i++) {
      const g = grads[i] / BATCH;
      const j = off + i;
      model.m[j] = b1 * model.m[j] + (1 - b1) * g;
      model.v[j] = b2 * model.v[j] + (1 - b2) * g * g;
      params[i] -= (LR * (model.m[j] / corr1)) / (Math.sqrt(model.v[j] / corr2) + 1e-8);
    }
  };
  apply(w, gw, 0);
  apply(b, gb, D * N);
  return lossSum / (BATCH * N);
}

export default function SuperpositionToy() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const modelRef = useRef<Model>(initModel(42));
  const randRef = useRef<() => number>(mulberry32(1234));
  const rafRef = useRef<number | undefined>(undefined);
  const stepRef = useRef(0);

  const [sparsity, setSparsity] = useState(0.9);
  const [reduce, setReduce] = useState(false);
  const [stats, setStats] = useState({ loss: 0, kept: 0, done: false });

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  function draw() {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const { w } = modelRef.current;
    ctx.clearRect(0, 0, SIZE, SIZE);
    const c = SIZE / 2;
    const scale = SIZE * 0.42;
    // unit circle + axes
    ctx.strokeStyle = "rgba(42,53,86,0.9)";
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(c, c, scale, 0, 2 * Math.PI);
    ctx.stroke();
    ctx.beginPath();
    ctx.moveTo(0, c);
    ctx.lineTo(SIZE, c);
    ctx.moveTo(c, 0);
    ctx.lineTo(c, SIZE);
    ctx.stroke();
    // feature direction arrows W_i
    for (let i = 0; i < N; i++) {
      const x = w[0 * N + i];
      const y = w[1 * N + i];
      const px = c + x * scale;
      const py = c - y * scale;
      ctx.strokeStyle = FEATURE_COLORS[i];
      ctx.fillStyle = FEATURE_COLORS[i];
      ctx.lineWidth = 2.5;
      ctx.beginPath();
      ctx.moveTo(c, c);
      ctx.lineTo(px, py);
      ctx.stroke();
      ctx.beginPath();
      ctx.arc(px, py, 5, 0, 2 * Math.PI);
      ctx.fill();
      ctx.font = "11px ui-monospace, monospace";
      const lx = c + x * scale * 1.14;
      const ly = c - y * scale * 1.14;
      ctx.fillText(`f${i + 1}`, lx - 7, ly + 4);
    }
  }

  function syncStats(done: boolean, loss: number) {
    const { w } = modelRef.current;
    let kept = 0;
    for (let i = 0; i < N; i++) {
      const norm = Math.hypot(w[i], w[N + i]);
      if (norm > 0.5) kept++;
    }
    setStats({ loss, kept, done });
  }

  // (Re)train whenever sparsity changes.
  useEffect(() => {
    window.cancelAnimationFrame(rafRef.current ?? 0);
    modelRef.current = initModel(42);
    randRef.current = mulberry32(1234);
    stepRef.current = 0;

    if (reduce) {
      let loss = 0;
      for (let s = 0; s < TOTAL_STEPS; s++) loss = trainStep(modelRef.current, sparsity, randRef.current);
      draw();
      syncStats(true, loss);
      return;
    }
    const tick = () => {
      let loss = 0;
      for (let i = 0; i < STEPS_PER_FRAME && stepRef.current < TOTAL_STEPS; i++, stepRef.current++)
        loss = trainStep(modelRef.current, sparsity, randRef.current);
      draw();
      syncStats(stepRef.current >= TOTAL_STEPS, loss);
      if (stepRef.current < TOTAL_STEPS) rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sparsity, reduce]);

  useEffect(() => () => window.cancelAnimationFrame(rafRef.current ?? 0), []);

  const geometry =
    stats.kept >= 5 ? "a pentagon — all 5 features, squeezed in" : stats.kept === 4 ? "two antipodal pairs" : stats.kept === 3 ? "a triangle of features" : `only ${stats.kept} features — the rest sacrificed`;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={SIZE}
          height={SIZE}
          className="w-full max-w-[280px] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
          style={{ aspectRatio: "1 / 1" }}
          role="img"
          aria-label={`Five feature directions in the model's 2D hidden space. Current geometry: ${geometry}.`}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-data-400)]">{stats.loss.toFixed(4)}</div>
          <div className="text-[10px] text-[var(--color-muted)]">reconstruction loss</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-fg)]">{stats.kept}/5</div>
          <div className="text-[10px] text-[var(--color-muted)]">features represented</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="text-xs leading-5 text-[var(--color-fg)]">{stats.done ? "settled" : "training…"}</div>
          <div className="text-[10px] text-[var(--color-muted)]">15 parameters, live</div>
        </div>
      </div>

      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>feature sparsity (how rarely each feature appears)</span>
          <span className="font-mono text-[var(--color-fg)]">{(sparsity * 100).toFixed(0)}%</span>
        </span>
        <input
          type="range"
          min={0}
          max={0.98}
          step={0.02}
          value={sparsity}
          onChange={(e) => setSparsity(Number(e.target.value))}
          aria-label="Feature sparsity"
          suppressHydrationWarning
          className="mt-1 w-full accent-[var(--color-unique-500)]"
        />
      </label>

      <p className="text-xs text-[var(--color-muted)]">
        Each arrow is where one of 5 features lives in the model's 2-dimensional hidden space —
        recomputed by real training every time you move the slider. Dense features (0%): it keeps 2
        and drops the rest. Sparse (90%+): it crams all five in at {" "}
        <span className="text-[var(--color-fg)]">{geometry}</span> angles, betting they rarely
        collide. (Anthropic, “Toy Models of Superposition,” 2022.)
      </p>
    </div>
  );
}
