import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";
import { paintSurface, drawPoints } from "../../lib/boundary";
import {
  createNet,
  forward,
  makeDataset,
  mulberry32,
  netLoss,
  sgdStep,
  type Net,
  type Pt,
} from "../../lib/tinynet";

/** Memorizing vs generalizing: train on HALF the points (solid), score on the
 *  held-out half (hollow). Crank noise + capacity and watch the big net carve
 *  ragged islands around noise — train loss falls, test loss doesn't follow.
 *  Retrains live (chunked over rAF; one shot under reduced motion). */

const CAPACITIES = [
  { key: "tiny", label: "tiny (3)", sizes: [2, 3, 1], epochs: 800, lr: 0.5 },
  { key: "right", label: "medium (8)", sizes: [2, 8, 1], epochs: 1200, lr: 0.5 },
  { key: "huge", label: "huge (16×16)", sizes: [2, 16, 16, 1], epochs: 2600, lr: 0.5 },
] as const;
type CapKey = (typeof CAPACITIES)[number]["key"];

const N = 150; // total points; even indices train, odd test

export default function OverfitLab() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef<number | undefined>(undefined);
  const netRef = useRef<Net | null>(null);
  const trainRef = useRef<Pt[]>([]);
  const testRef = useRef<Pt[]>([]);

  const [noise, setNoise] = useState(0.14);
  const [cap, setCap] = useState<CapKey>("huge");
  const [reduce, setReduce] = useState(false);
  const [stats, setStats] = useState<{ train: number; test: number; done: boolean } | null>(null);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  function paint() {
    const canvas = canvasRef.current;
    const net = netRef.current;
    if (!canvas || !net) return;
    paintSurface(canvas, (x, y) => forward(net, x, y), 72);
    const all = [...trainRef.current, ...testRef.current];
    drawPoints(canvas, all, { hollow: (_p, i) => i >= trainRef.current.length });
  }

  // Retrain whenever noise or capacity changes.
  useEffect(() => {
    window.cancelAnimationFrame(rafRef.current ?? 0);
    const spec = CAPACITIES.find((c) => c.key === cap)!;
    const pts = makeDataset("circle", N, noise, 23);
    // Shuffle before splitting — the circle generator alternates classes by
    // index, so a parity split without this would put every inside point in
    // train and every ring point in test.
    const rand = mulberry32(99);
    for (let i = pts.length - 1; i > 0; i--) {
      const j = Math.floor(rand() * (i + 1));
      [pts[i], pts[j]] = [pts[j], pts[i]];
    }
    trainRef.current = pts.filter((_, i) => i % 2 === 0);
    testRef.current = pts.filter((_, i) => i % 2 === 1);
    const net = createNet([...spec.sizes], 42);
    netRef.current = net;

    const update = (done: boolean) =>
      setStats({
        train: netLoss(net, trainRef.current),
        test: netLoss(net, testRef.current),
        done,
      });

    if (reduce) {
      // One synchronous shot, one repaint — no animation.
      for (let e = 0; e < spec.epochs; e++) sgdStep(net, trainRef.current, spec.lr);
      paint();
      update(true);
      return;
    }
    let epoch = 0;
    const tick = () => {
      for (let i = 0; i < 60 && epoch < spec.epochs; i++, epoch++)
        sgdStep(net, trainRef.current, spec.lr);
      paint();
      update(epoch >= spec.epochs);
      if (epoch < spec.epochs) rafRef.current = window.requestAnimationFrame(tick);
    };
    rafRef.current = window.requestAnimationFrame(tick);
    return () => window.cancelAnimationFrame(rafRef.current ?? 0);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [noise, cap, reduce]);

  const gap = stats ? stats.test - stats.train : 0;
  const overfitting = stats?.done && gap > 0.25;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="w-full max-w-[280px] rounded-xl border border-[var(--color-line)]"
          style={{ aspectRatio: "1 / 1" }}
          role="img"
          aria-label="Decision boundary trained on the solid points only; hollow points are the held-out test set"
        />
      </div>

      <div className="grid grid-cols-2 gap-2 text-center" aria-live="polite">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-data-400)]">
            {stats ? stats.train.toFixed(3) : "…"}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">train loss (solid dots — it saw these)</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div
            className={
              "font-mono text-lg " +
              (overfitting ? "text-[var(--color-unique-400)]" : "text-[var(--color-shared-400)]")
            }
          >
            {stats ? stats.test.toFixed(3) : "…"}
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">test loss (hollow dots — never seen)</div>
        </div>
      </div>

      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>label noise in the data</span>
          <span className="font-mono text-[var(--color-fg)]">{noise.toFixed(2)}</span>
        </span>
        <input
          type="range"
          min={0}
          max={0.25}
          step={0.01}
          value={noise}
          onChange={(e) => setNoise(Number(e.target.value))}
          aria-label="Dataset noise"
          suppressHydrationWarning
          className="mt-1 w-full accent-[var(--color-data-500)]"
        />
      </label>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {CAPACITIES.map((c) => (
            <button
              key={c.key}
              type="button"
              onClick={() => setCap(c.key)}
              aria-pressed={cap === c.key}
              className={
                "px-2.5 py-1 " +
                (cap === c.key
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {c.label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-muted)]">network capacity</span>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        {overfitting
          ? `Gap of ${gap.toFixed(2)}: the boundary is carving little islands around noisy training dots — memorizing, not learning. The hollow dots pay the price.`
          : "The real test of learning is the hollow dots. Push noise up with the huge network and watch train loss and test loss come apart."}
      </p>
    </div>
  );
}
