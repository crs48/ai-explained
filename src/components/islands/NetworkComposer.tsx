import { useEffect, useMemo, useRef, useState } from "react";
import { paintSurface, drawPoints } from "../../lib/boundary";
import { createNet, forward, makeDataset, sgdStep, type Net, type Pt } from "../../lib/tinynet";

/** Neurons compose: a 2-4-1 net trained on XOR (deterministic seed, trains in
 *  ~100ms on mount). Every hidden neuron is rendered as its own mini decision
 *  boundary — TF Playground's best trick — and clicking one shows it large.
 *  Four straight lines, combined, make a shape none of them could alone. */

const THUMB = 56;
const SEED = 42;

export default function NetworkComposer() {
  const mainRef = useRef<HTMLCanvasElement>(null);
  const thumbRefs = useRef<(HTMLCanvasElement | null)[]>([]);
  const [net, setNet] = useState<Net | null>(null);
  const [selected, setSelected] = useState<number | null>(null); // hidden idx or null = output

  const pts = useMemo<Pt[]>(() => makeDataset("xor", 160, 0.05, 7), []);

  // Train once on mount — deterministic, fast, done before first paint matters.
  useEffect(() => {
    const n = createNet([2, 4, 1], SEED);
    for (let e = 0; e < 400; e++) sgdStep(n, pts, 0.5);
    setNet(n);
  }, [pts]);

  // Paint the 4 hidden-neuron thumbnails.
  useEffect(() => {
    if (!net) return;
    for (let j = 0; j < 4; j++) {
      const c = thumbRefs.current[j];
      if (!c) continue;
      paintSurface(
        c,
        (x, y) => {
          const acts: number[][] = [];
          forward(net, x, y, acts);
          return (acts[1][j] + 1) / 2; // tanh −1..1 → 0..1
        },
        28,
      );
    }
  }, [net]);

  // Paint the main canvas: selected hidden neuron, or the whole net's output.
  useEffect(() => {
    const canvas = mainRef.current;
    if (!canvas || !net) return;
    if (selected === null) {
      paintSurface(canvas, (x, y) => forward(net, x, y), 72);
      drawPoints(canvas, pts);
    } else {
      paintSurface(
        canvas,
        (x, y) => {
          const acts: number[][] = [];
          forward(net, x, y, acts);
          return (acts[1][selected] + 1) / 2;
        },
        72,
      );
    }
  }, [net, selected, pts]);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center gap-4">
        {/* the network: inputs → 4 hidden thumbnails → output */}
        <div className="flex flex-col items-center gap-2">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            hidden neurons
          </span>
          {[0, 1, 2, 3].map((j) => (
            <button
              key={j}
              type="button"
              onClick={() => setSelected(selected === j ? null : j)}
              aria-pressed={selected === j}
              aria-label={`Show hidden neuron ${j + 1}'s view of the plane`}
              className={
                "overflow-hidden rounded-md border " +
                (selected === j
                  ? "border-[var(--color-data-400)] ring-1 ring-[var(--color-data-400)]"
                  : "border-[var(--color-line)] hover:border-[var(--color-muted)]")
              }
            >
              <canvas
                ref={(el) => {
                  thumbRefs.current[j] = el;
                }}
                width={THUMB}
                height={THUMB}
                className="block"
                style={{ width: THUMB, height: THUMB }}
              />
            </button>
          ))}
        </div>

        <div className="text-2xl text-[var(--color-muted)]" aria-hidden="true">
          →
        </div>

        <div className="flex flex-col items-center gap-1.5">
          <span className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
            {selected === null ? "the whole network" : `hidden neuron ${selected + 1} alone`}
          </span>
          <canvas
            ref={mainRef}
            width={280}
            height={280}
            className="w-full max-w-[260px] rounded-xl border border-[var(--color-line)]"
            style={{ aspectRatio: "1 / 1" }}
            role="img"
            aria-label={
              selected === null
                ? "The trained network's combined decision boundary on the XOR data"
                : `Hidden neuron ${selected + 1}'s individual straight boundary`
            }
          />
          {selected !== null && (
            <button
              type="button"
              onClick={() => setSelected(null)}
              className="rounded-md border border-[var(--color-line)] px-2 py-0.5 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              ← back to the combined view
            </button>
          )}
        </div>
      </div>

      <p className="text-xs text-[var(--color-muted)]" aria-live="polite">
        {net === null
          ? "Training a 2-4-1 network on the XOR data in your browser…"
          : selected === null
            ? "Each thumbnail is ONE hidden neuron's view — every one is just a straight boundary, like the last panel. Click one. The combined map is the output neuron blending all four."
            : "One neuron alone: a single straight divide. No single neuron can cut XOR's four quadrants — but a weighted blend of four of them can."}
      </p>
    </div>
  );
}
