import { useMemo, useState } from "react";
import { mulberry32, gaussian } from "../../lib/tinynet";

/** Loss made tangible: fit a line to points with two knobs and watch a single
 *  "wrongness" number respond. Residuals are drawn as literal error bars —
 *  loss is just their (squared) sum. SVG, no canvas needed. */

const W = 320;
const H = 240;
// x/y data range in "math" coords.
const XR: [number, number] = [-1, 1];
const YR: [number, number] = [-1.6, 1.6];

const TRUE_M = 0.9;
const TRUE_C = 0.2;

export default function LossMeter() {
  const [m, setM] = useState(-0.6); // start clearly wrong
  const [c, setC] = useState(-0.5);

  const pts = useMemo(() => {
    const rand = mulberry32(19);
    return Array.from({ length: 11 }, (_, i) => {
      const x = -0.9 + (i / 10) * 1.8;
      return { x, y: TRUE_M * x + TRUE_C + gaussian(rand) * 0.12 };
    });
  }, []);

  const sx = (x: number) => ((x - XR[0]) / (XR[1] - XR[0])) * W;
  const sy = (y: number) => H - ((y - YR[0]) / (YR[1] - YR[0])) * H;

  const loss = useMemo(
    () => pts.reduce((s, p) => s + (m * p.x + c - p.y) ** 2, 0) / pts.length,
    [pts, m, c],
  );
  // Best possible loss for context (least squares over this fixed sample).
  const bestLoss = useMemo(() => {
    const n = pts.length;
    const mx = pts.reduce((s, p) => s + p.x, 0) / n;
    const my = pts.reduce((s, p) => s + p.y, 0) / n;
    const beta =
      pts.reduce((s, p) => s + (p.x - mx) * (p.y - my), 0) /
      pts.reduce((s, p) => s + (p.x - mx) ** 2, 0);
    const alpha = my - beta * mx;
    return pts.reduce((s, p) => s + (beta * p.x + alpha - p.y) ** 2, 0) / n;
  }, [pts]);

  const barMax = 1.2; // loss value that fills the meter
  const barPct = Math.min(1, loss / barMax) * 100;
  const nearBest = loss < bestLoss * 1.6;

  const knob = (label: string, value: number, set: (v: number) => void) => (
    <label className="flex-1 text-xs">
      <span className="flex justify-between text-[var(--color-muted)]">
        <span>{label}</span>
        <span className="font-mono text-[var(--color-fg)]">{value.toFixed(2)}</span>
      </span>
      <input
        type="range"
        min={-1.5}
        max={1.5}
        step={0.05}
        value={value}
        onChange={(e) => set(Number(e.target.value))}
        aria-label={label}
        suppressHydrationWarning
        className="mt-1 w-full accent-[var(--color-weight-500)]"
      />
    </label>
  );

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-1 items-center justify-center">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          className="w-full max-w-[340px] rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)]"
          role="img"
          aria-label={`A line with slope ${m.toFixed(2)} and offset ${c.toFixed(2)} through 11 points; mean squared error ${loss.toFixed(3)}`}
        >
          {/* residuals — the wrongness, drawn */}
          {pts.map((p, i) => (
            <line
              key={`r${i}`}
              x1={sx(p.x)}
              y1={sy(p.y)}
              x2={sx(p.x)}
              y2={sy(m * p.x + c)}
              stroke="var(--color-unique-400)"
              strokeWidth={1.5}
              strokeDasharray="3 2"
              opacity={0.8}
            />
          ))}
          {/* the model */}
          <line
            x1={sx(XR[0])}
            y1={sy(m * XR[0] + c)}
            x2={sx(XR[1])}
            y2={sy(m * XR[1] + c)}
            stroke="var(--color-weight-400)"
            strokeWidth={2.5}
          />
          {/* the data */}
          {pts.map((p, i) => (
            <circle key={i} cx={sx(p.x)} cy={sy(p.y)} r={4} fill="var(--color-data-400)" stroke="var(--color-ink)" />
          ))}
        </svg>
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5">
        <div className="flex items-baseline justify-between text-xs text-[var(--color-muted)]">
          <span>loss (mean squared error)</span>
          <span className="font-mono text-lg text-[var(--color-fg)]" aria-live="polite">
            {loss.toFixed(3)}
          </span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded-full bg-[var(--color-surface)]">
          <div
            className="h-full rounded-full"
            style={{
              width: `${barPct}%`,
              background: nearBest ? "var(--color-shared-500)" : "var(--color-unique-500)",
              transition: "width 150ms ease, background 300ms ease",
            }}
          />
        </div>
        <p className="mt-1.5 text-xs text-[var(--color-muted)]">
          {nearBest
            ? `Nice — close to the best this line can do (${bestLoss.toFixed(3)}; the noise means it can never hit 0).`
            : "Every dashed pink bar is one prediction's miss. Loss squares and averages them into one number. Make it small."}
        </p>
      </div>

      <div className="flex gap-3">
        {knob("slope (a weight)", m, setM)}
        {knob("offset (a bias)", c, setC)}
      </div>
    </div>
  );
}
