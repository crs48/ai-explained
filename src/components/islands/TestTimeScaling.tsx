import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Test-time (inference-time) compute scaling. Accuracy climbs roughly LINEARLY
 *  as compute grows EXPONENTIALLY — a log-linear curve that saturates toward a
 *  ceiling. A verifier lifts the ceiling and cleans up the scaling; without one
 *  the gains flatten and plateau. Numbers are illustrative, the shape is real. */

// X axis spans 1× → 1000× compute, shown on a log scale. We work in log10 units:
// LOG_MIN = 0 (1×), LOG_MAX = 3 (1000×).
const LOG_MIN = 0;
const LOG_MAX = 3;

const X_TICKS = [
  { log: 0, label: "1×" },
  { log: 1, label: "10×" },
  { log: 2, label: "100×" },
  { log: 3, label: "1000×" },
];
const Y_TICKS = [0, 25, 50, 75, 100];

// viewBox geometry.
const V_W = 320;
const V_H = 200;
const PAD_L = 34;
const PAD_R = 12;
const PAD_T = 12;
const PAD_B = 26;
const PLOT_W = V_W - PAD_L - PAD_R;
const PLOT_H = V_H - PAD_T - PAD_B;

/** Map a log10-compute value to an SVG x coordinate. */
function xScale(logx: number): number {
  const t = (logx - LOG_MIN) / (LOG_MAX - LOG_MIN);
  return PAD_L + t * PLOT_W;
}

/** Map an accuracy (0–100) to an SVG y coordinate (inverted). */
function yScale(acc: number): number {
  return PAD_T + (1 - acc / 100) * PLOT_H;
}

interface Curve {
  ceiling: number;
  /** accuracy (0–100) as a function of log10-compute */
  accuracy: (logx: number) => number;
}

/** With a verifier: clean log-linear rise to a high ceiling (~85%). */
const VERIFIER_ON: Curve = {
  ceiling: 85,
  accuracy: (logx: number) => {
    const t = clamp01((logx - LOG_MIN) / (LOG_MAX - LOG_MIN));
    // start ~18%, rise linearly against log-x toward the ceiling.
    return clamp(18 + t * (85 - 18), 0, 100);
  },
};

/** Without a verifier: lower ceiling (~45%), flatter, and it plateaus early —
 *  a gentle log curve rather than a clean line, with a small dip to suggest the
 *  gains get murky once you can't check the answers. */
const VERIFIER_OFF: Curve = {
  ceiling: 45,
  accuracy: (logx: number) => {
    const t = clamp01((logx - LOG_MIN) / (LOG_MAX - LOG_MIN));
    // concave: fast at first, then flattens (plateau). sqrt-ish shape on log-x.
    const shaped = Math.sqrt(t);
    // small wobble so it reads as "noisier / murkier".
    const wobble = 3 * Math.sin(t * Math.PI * 3);
    return clamp(15 + shaped * (45 - 15) + wobble * t, 0, 100);
  },
};

function clamp(v: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, v));
}
function clamp01(v: number): number {
  return clamp(v, 0, 1);
}

/** Build an SVG polyline path string for a curve sampled across the log-x range. */
function curvePath(curve: Curve, samples = 60): string {
  const pts: string[] = [];
  for (let i = 0; i <= samples; i++) {
    const logx = LOG_MIN + (i / samples) * (LOG_MAX - LOG_MIN);
    const x = xScale(logx);
    const y = yScale(curve.accuracy(logx));
    pts.push(`${x.toFixed(2)},${y.toFixed(2)}`);
  }
  return "M" + pts.join(" L");
}

export default function TestTimeScaling() {
  // Thinking budget as a log10-compute value (0 → 1×, 3 → 1000×).
  const [budgetLog, setBudgetLog] = useState(1.5);
  const [verifier, setVerifier] = useState(true);

  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const curve = verifier ? VERIFIER_ON : VERIFIER_OFF;
  const otherCurve = verifier ? VERIFIER_OFF : VERIFIER_ON;

  const path = useMemo(() => curvePath(curve), [curve]);
  const otherPath = useMemo(() => curvePath(otherCurve), [otherCurve]);

  const compute = Math.pow(10, budgetLog);
  const accuracy = curve.accuracy(budgetLog);
  const dotX = xScale(budgetLog);
  const dotY = yScale(accuracy);

  const computeLabel =
    compute >= 100
      ? `${Math.round(compute)}×`
      : compute >= 10
        ? `${compute.toFixed(0)}×`
        : `${compute.toFixed(1)}×`;

  const lineColor = verifier ? "var(--color-unique-500)" : "var(--color-shared-500)";
  const lineColorGhost = verifier ? "var(--color-shared-400)" : "var(--color-unique-400)";

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* verifier toggle */}
      <div className="flex flex-wrap items-center gap-2 text-xs">
        <span className="text-[var(--color-muted)]">Verifier</span>
        <button
          type="button"
          onClick={() => setVerifier(true)}
          aria-pressed={verifier}
          className={
            "rounded-md px-2.5 py-1 font-medium " +
            (verifier
              ? "bg-[var(--color-unique-500)] text-white"
              : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
          }
        >
          on
        </button>
        <button
          type="button"
          onClick={() => setVerifier(false)}
          aria-pressed={!verifier}
          className={
            "rounded-md px-2.5 py-1 font-medium " +
            (!verifier
              ? "bg-[var(--color-shared-500)] text-white"
              : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
          }
        >
          off
        </button>
        <span className="ml-auto text-[var(--color-muted)]">
          ceiling ≈ <span className="font-mono text-[var(--color-fg)]">{curve.ceiling}%</span>
        </span>
      </div>

      {/* chart */}
      <svg
        viewBox={`0 0 ${V_W} ${V_H}`}
        className="w-full"
        role="img"
        aria-label={`Accuracy versus test-time compute on a log scale, verifier ${
          verifier ? "on" : "off"
        }. At ${computeLabel} compute, predicted accuracy is ${accuracy.toFixed(0)} percent.`}
      >
        {/* y gridlines + labels */}
        {Y_TICKS.map((acc) => {
          const y = yScale(acc);
          return (
            <g key={`y${acc}`}>
              <line
                x1={PAD_L}
                y1={y}
                x2={V_W - PAD_R}
                y2={y}
                stroke="var(--color-line)"
                strokeWidth={0.4}
                opacity={0.5}
              />
              <text
                x={PAD_L - 5}
                y={y + 2.5}
                fontSize={7}
                textAnchor="end"
                className="fill-[var(--color-muted)]"
              >
                {acc}%
              </text>
            </g>
          );
        })}

        {/* x ticks + labels */}
        {X_TICKS.map((t) => {
          const x = xScale(t.log);
          return (
            <g key={`x${t.log}`}>
              <line
                x1={x}
                y1={PAD_T}
                x2={x}
                y2={V_H - PAD_B}
                stroke="var(--color-line)"
                strokeWidth={0.4}
                opacity={0.35}
              />
              <text
                x={x}
                y={V_H - PAD_B + 10}
                fontSize={7}
                textAnchor="middle"
                className="fill-[var(--color-muted)]"
              >
                {t.label}
              </text>
            </g>
          );
        })}

        {/* axis titles */}
        <text
          x={PAD_L + PLOT_W / 2}
          y={V_H - 2}
          fontSize={7}
          textAnchor="middle"
          className="fill-[var(--color-muted)]"
        >
          test-time compute (log scale)
        </text>
        <text
          x={9}
          y={PAD_T + PLOT_H / 2}
          fontSize={7}
          textAnchor="middle"
          transform={`rotate(-90 9 ${PAD_T + PLOT_H / 2})`}
          className="fill-[var(--color-muted)]"
        >
          accuracy
        </text>

        {/* ghost of the other state, for contrast */}
        <path
          d={otherPath}
          fill="none"
          stroke={lineColorGhost}
          strokeWidth={1}
          strokeDasharray="2 2"
          opacity={0.4}
        />

        {/* active accuracy curve */}
        <path
          d={path}
          fill="none"
          stroke={lineColor}
          strokeWidth={2}
          strokeLinecap="round"
          strokeLinejoin="round"
          style={{ transition: reduce ? "none" : "d 250ms ease" }}
        />

        {/* budget marker: vertical guide + moving dot */}
        <line
          x1={dotX}
          y1={PAD_T}
          x2={dotX}
          y2={V_H - PAD_B}
          stroke={lineColor}
          strokeWidth={0.6}
          strokeDasharray="1.5 1.5"
          opacity={0.6}
          style={{ transition: reduce ? "none" : "x1 120ms linear, x2 120ms linear" }}
        />
        <circle
          cx={dotX}
          cy={dotY}
          r={3.4}
          fill={lineColor}
          stroke="white"
          strokeWidth={1}
          style={{
            transition: reduce ? "none" : "cx 120ms linear, cy 120ms linear",
          }}
        />
      </svg>

      {/* thinking budget slider */}
      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>Thinking budget</span>
          <span className="font-mono text-[var(--color-fg)]">{computeLabel} compute</span>
        </span>
        <input
          type="range"
          min={LOG_MIN}
          max={LOG_MAX}
          step={0.01}
          value={budgetLog}
          onChange={(e) => setBudgetLog(Number(e.target.value))}
          aria-label="Thinking budget (test-time compute multiplier)"
          className="mt-1 w-full"
          style={{ accentColor: lineColor }}
        />
      </label>

      {/* live readout */}
      <p
        className="text-sm text-[var(--color-muted)]"
        aria-live="polite"
      >
        At <span className="font-mono text-[var(--color-fg)]">{computeLabel}</span> compute,
        predicted accuracy ≈{" "}
        <span className="font-mono font-semibold" style={{ color: lineColor }}>
          {accuracy.toFixed(0)}%
        </span>
        .{" "}
        <span className="italic">
          Clean scaling like this holds when an external verifier can check the answers — without
          one, the gains are murkier.
        </span>
      </p>

      {/* anchor fact */}
      <p className="rounded-md border-l-2 border-[var(--color-unique-500)] bg-[var(--color-surface-2)] px-3 py-2 text-xs text-[var(--color-fg)]">
        <span className="font-semibold text-[var(--color-unique-400)]">DeepSeek-R1-Zero</span>{" "}
        climbed from <span className="font-mono">15.6%</span> →{" "}
        <span className="font-mono">71.0%</span> pass@1 on AIME 2024 as it learned, on its own, to
        think for longer.
      </p>
    </div>
  );
}
