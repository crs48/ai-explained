import { useEffect, useRef, useState } from "react";
import { paintSurface } from "../../lib/boundary";

/** One neuron, hands-on: two weight knobs, a bias knob, an activation picker.
 *  The canvas paints the neuron's output over the whole 2D input plane, so
 *  turning a knob visibly tilts/shifts its little decision boundary. */

const ACTIVATIONS = {
  step: { label: "step", f: (z: number) => (z > 0 ? 1 : 0) },
  sigmoid: { label: "sigmoid", f: (z: number) => 1 / (1 + Math.exp(-4 * z)) },
  tanh: { label: "tanh", f: (z: number) => (Math.tanh(2 * z) + 1) / 2 },
  relu: { label: "ReLU", f: (z: number) => Math.min(1, Math.max(0, z)) },
} as const;
type ActKey = keyof typeof ACTIVATIONS;

export default function NeuronForge() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [w1, setW1] = useState(1.6);
  const [w2, setW2] = useState(1.0);
  const [b, setB] = useState(-0.3);
  const [act, setAct] = useState<ActKey>("sigmoid");

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const f = ACTIVATIONS[act].f;
    paintSurface(canvas, (x, y) => f(w1 * x + w2 * y + b), 80);
    // Draw the z = 0 line — the boundary itself — when it exists in view.
    const ctx = canvas.getContext("2d");
    if (!ctx || (w1 === 0 && w2 === 0)) return;
    const px = (x: number) => ((x + 1) / 2) * canvas.width;
    const py = (y: number) => ((1 - y) / 2) * canvas.height;
    // Two far-apart points on the line w1·x + w2·y + b = 0.
    const pts: [number, number][] = [];
    if (Math.abs(w2) > Math.abs(w1)) {
      for (const x of [-2, 2]) pts.push([x, -(w1 * x + b) / w2]);
    } else {
      for (const y of [-2, 2]) pts.push([-(w2 * y + b) / w1, y]);
    }
    ctx.beginPath();
    ctx.moveTo(px(pts[0][0]), py(pts[0][1]));
    ctx.lineTo(px(pts[1][0]), py(pts[1][1]));
    ctx.strokeStyle = "rgba(232,236,247,0.85)";
    ctx.lineWidth = 1.5;
    ctx.setLineDash([6, 4]);
    ctx.stroke();
    ctx.setLineDash([]);
  }, [w1, w2, b, act]);

  const knob = (
    label: string,
    value: number,
    set: (v: number) => void,
    color: string,
  ) => (
    <label className="text-xs">
      <span className="flex justify-between text-[var(--color-muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--color-fg)]">{value.toFixed(1)}</span>
      </span>
      <input
        type="range"
        min={-3}
        max={3}
        step={0.1}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        suppressHydrationWarning
        className="mt-1 w-full"
        style={{ accentColor: color }}
      />
    </label>
  );

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <canvas
          ref={canvasRef}
          width={320}
          height={320}
          className="w-full max-w-[300px] rounded-xl border border-[var(--color-line)]"
          style={{ aspectRatio: "1 / 1" }}
          role="img"
          aria-label={`One neuron's output over the input plane: ${ACTIVATIONS[act].label} of ${w1.toFixed(1)}·x₁ + ${w2.toFixed(1)}·x₂ + ${b.toFixed(1)}`}
        />
      </div>

      <p className="text-center font-mono text-xs text-[var(--color-muted)]" aria-live="polite">
        out = <span className="text-[var(--color-fg)]">{ACTIVATIONS[act].label}</span>(
        <span className="text-[var(--color-weight-400)]">{w1.toFixed(1)}</span>·x₁ +{" "}
        <span className="text-[var(--color-weight-400)]">{w2.toFixed(1)}</span>·x₂ +{" "}
        <span className="text-[var(--color-weight-400)]">{b.toFixed(1)}</span>)
      </p>

      <div className="grid grid-cols-3 gap-3">
        {knob("weight w₁", w1, setW1, "var(--color-weight-500)")}
        {knob("weight w₂", w2, setW2, "var(--color-weight-500)")}
        {knob("bias b", b, setB, "var(--color-weight-500)")}
      </div>

      <div className="flex items-center justify-between gap-2">
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {(Object.keys(ACTIVATIONS) as ActKey[]).map((k) => (
            <button
              key={k}
              type="button"
              onClick={() => setAct(k)}
              aria-pressed={act === k}
              className={
                "px-2.5 py-1 " +
                (act === k
                  ? "bg-[var(--color-data-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {ACTIVATIONS[k].label}
            </button>
          ))}
        </div>
        <span className="text-xs text-[var(--color-muted)]">activation</span>
      </div>

      <p className="text-xs text-[var(--color-muted)]">
        Amber ↔ blue is the neuron's output over every possible input; the dashed line is where it
        flips. Weights tilt the line, bias slides it, the activation sets how hard the flip is.
      </p>
    </div>
  );
}
