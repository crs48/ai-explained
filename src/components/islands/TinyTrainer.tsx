import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";
import { paintSurface, drawPoints } from "../../lib/boundary";
import {
  DATASETS,
  accuracy,
  createNet,
  forward,
  makeDataset,
  netLoss,
  sgdStep,
  type DatasetKey,
  type Net,
  type Pt,
} from "../../lib/tinynet";

/** The payoff island: a 2-8-8-1 network trains LIVE on 2D toy data in the
 *  reader's browser — real forward/backward passes, ~20 full-batch epochs per
 *  animation frame, decision boundary repainted as it learns. No ML library,
 *  no downloads, no precomputed anything (see scripts/test-tinynet.mjs).
 *  Reduced motion: no autoplay — a "train 200 epochs" button repaints once. */

const SIZES = [2, 8, 8, 1];
const SEED = 42;
const N_POINTS = 260;
const NOISE = 0.04;
const EPOCHS_PER_FRAME = 20;
const MAX_EPOCHS = 6000;
const LR = { xor: 0.4, circle: 0.4, spiral: 0.6 } as const;

export default function TinyTrainer() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sparkRef = useRef<HTMLCanvasElement>(null);
  const netRef = useRef<Net | null>(null);
  const ptsRef = useRef<Pt[]>([]);
  const lossesRef = useRef<number[]>([]);
  const epochRef = useRef(0);
  const rafRef = useRef<number | undefined>(undefined);

  const [dataset, setDataset] = useState<DatasetKey>("spiral");
  const [running, setRunning] = useState(false);
  const [reduce, setReduce] = useState(false);
  const [stats, setStats] = useState({ epoch: 0, loss: 0, acc: 0 });

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  function paint() {
    const canvas = canvasRef.current;
    const net = netRef.current;
    if (!canvas || !net) return;
    paintSurface(canvas, (x, y) => forward(net, x, y), 64);
    drawPoints(canvas, ptsRef.current);
    paintSparkline();
  }

  function paintSparkline() {
    const c = sparkRef.current;
    if (!c) return;
    const ctx = c.getContext("2d");
    if (!ctx) return;
    ctx.clearRect(0, 0, c.width, c.height);
    const losses = lossesRef.current;
    if (losses.length < 2) return;
    const max = Math.max(...losses);
    ctx.beginPath();
    losses.forEach((l, i) => {
      const x = (i / (losses.length - 1)) * c.width;
      const y = c.height - (l / max) * (c.height - 3) - 1.5;
      i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y);
    });
    ctx.strokeStyle = "#37d9c3";
    ctx.lineWidth = 1.5;
    ctx.stroke();
  }

  function syncStats() {
    const net = netRef.current;
    const pts = ptsRef.current;
    if (!net) return;
    setStats({ epoch: epochRef.current, loss: netLoss(net, pts), acc: accuracy(net, pts) });
  }

  function reset(key: DatasetKey) {
    stop();
    ptsRef.current = makeDataset(key, N_POINTS, NOISE, 11);
    netRef.current = createNet(SIZES, SEED);
    lossesRef.current = [];
    epochRef.current = 0;
    paint();
    syncStats();
  }

  function trainEpochs(n: number) {
    const net = netRef.current;
    if (!net) return;
    const lr = LR[datasetRef.current];
    for (let i = 0; i < n && epochRef.current < MAX_EPOCHS; i++) {
      const loss = sgdStep(net, ptsRef.current, lr);
      epochRef.current++;
      // Keep the sparkline bounded: decimate by 2 when it hits 240 samples.
      if (epochRef.current % 5 === 0) {
        lossesRef.current.push(loss);
        if (lossesRef.current.length > 240)
          lossesRef.current = lossesRef.current.filter((_, i) => i % 2 === 0);
      }
    }
  }

  // Refs so the rAF loop always sees current values without re-subscribing.
  const datasetRef = useRef(dataset);
  datasetRef.current = dataset;

  function stop() {
    window.cancelAnimationFrame(rafRef.current ?? 0);
    setRunning(false);
  }

  function start() {
    stop();
    setRunning(true);
    const tick = () => {
      trainEpochs(EPOCHS_PER_FRAME);
      paint();
      syncStats();
      if (epochRef.current < MAX_EPOCHS) rafRef.current = window.requestAnimationFrame(tick);
      else setRunning(false);
    };
    rafRef.current = window.requestAnimationFrame(tick);
  }

  // Init + re-init when the dataset changes.
  useEffect(() => {
    reset(dataset);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [dataset]);

  useEffect(() => () => window.cancelAnimationFrame(rafRef.current ?? 0), []);

  const converged = stats.acc > 0.97 && stats.epoch > 0;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {(Object.keys(DATASETS) as DatasetKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setDataset(k)}
              aria-pressed={dataset === k}
              className={
                "px-2.5 py-1 " +
                (dataset === k
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {DATASETS[k].label}
            </button>
          ))}
        </div>
        <span className="font-mono text-[10px] text-[var(--color-muted)]">
          2 → 8 → 8 → 1 · 105 knobs
        </span>
      </div>

      <div className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={300}
          height={300}
          className="w-full max-w-[280px] rounded-xl border border-[var(--color-line)]"
          style={{ aspectRatio: "1 / 1" }}
          role="img"
          aria-label={`Decision boundary after ${stats.epoch} epochs of training on the ${DATASETS[dataset].label} dataset — accuracy ${(stats.acc * 100).toFixed(0)}%`}
        />
      </div>

      <div className="grid grid-cols-3 gap-2 text-center">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-fg)]">{stats.epoch}</div>
          <div className="text-[10px] text-[var(--color-muted)]">epochs</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-data-400)]">{stats.loss.toFixed(3)}</div>
          <div className="text-[10px] text-[var(--color-muted)]">loss</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div
            className={
              "font-mono text-lg " +
              (converged ? "text-[var(--color-shared-400)]" : "text-[var(--color-fg)]")
            }
          >
            {(stats.acc * 100).toFixed(0)}%
          </div>
          <div className="text-[10px] text-[var(--color-muted)]">accuracy</div>
        </div>
      </div>

      <div className="flex items-center gap-2">
        <canvas
          ref={sparkRef}
          width={220}
          height={28}
          className="h-7 min-w-0 flex-1 rounded-md border border-[var(--color-line)] bg-[var(--color-surface)]"
          role="img"
          aria-label="Loss curve over training"
        />
        <span className="text-[10px] text-[var(--color-muted)]">loss ↓</span>
      </div>

      <div className="flex flex-wrap items-center gap-2" aria-live="polite">
        {reduce ? (
          <button
            type="button"
            onClick={() => {
              trainEpochs(200);
              paint();
              syncStats();
            }}
            className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
          >
            train 200 epochs
          </button>
        ) : (
          <button
            type="button"
            onClick={() => (running ? stop() : start())}
            className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {running ? "⏸ pause" : "▶ train"}
          </button>
        )}
        <button
          type="button"
          onClick={() => reset(dataset)}
          className="rounded-lg border border-[var(--color-line)] px-2.5 py-1.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
        >
          ↺ reset
        </button>
        <span className="ml-auto text-xs text-[var(--color-muted)]">
          {converged ? "✓ learned it" : running ? "learning…" : "untrained"}
        </span>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        This is not a recording. Your browser is running the full loop — forward, loss, backprop,
        nudge — about {EPOCHS_PER_FRAME * 60} times a second, and repainting what the network
        believes after every frame.
      </p>
    </div>
  );
}
