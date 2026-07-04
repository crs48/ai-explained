import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** "Break the router" — a live MoE load-balancing simulation. Without a
 *  balancing mechanism the router collapses (rich-get-richer: favored experts
 *  get more gradient → improve → get picked more; the rest die). Two fixes are
 *  simulated: Switch's auxiliary loss and DeepSeek-V3's aux-loss-free bias. */

type Mode = "none" | "aux" | "bias";

const EXPERTS = 8;
const TARGET = 1 / EXPERTS; // fair share: 12.5%
const BATCH = 32; // tokens routed per training step
const EMA = 0.18; // learning rate of the running utilization average
const RICH = 1.3; // rich-get-richer exponent (positive feedback)
const FLOOR = 0.008; // tiny routing floor so collapse tops out ~90%, not 100%
const AUX_PULL = 0.18; // auxiliary-loss pressure toward uniform
const BIAS_STEP = 0.08; // per-step bias nudge (DeepSeek-style)
const BIAS_MAX = 3;
const DEAD = 0.02; // below 2% of tokens an expert is effectively dead
const TICK_MS = 180;
const STEADY_STEPS = 400; // representative step count for reduced-motion jumps

interface Sim {
  shares: number[]; // running average of token share per expert
  biases: number[]; // per-expert routing bias (bias mode only)
  steps: number;
}

function initialSim(): Sim {
  return {
    shares: Array<number>(EXPERTS).fill(TARGET),
    biases: Array<number>(EXPERTS).fill(0),
    steps: 0,
  };
}

/** Where each mode ends up, for reduced-motion users: skip the animation. */
function steadyState(mode: Mode): Sim {
  if (mode === "none") {
    const shares = Array<number>(EXPERTS).fill((1 - 0.92) / (EXPERTS - 1));
    shares[2] = 0.92; // one winner takes ~90%+; the rest starve
    return { shares, biases: Array<number>(EXPERTS).fill(0), steps: STEADY_STEPS };
  }
  return { ...initialSim(), steps: STEADY_STEPS };
}

/** One training step: route a batch (probability ∝ share^1.3 — positive
 *  feedback), update the running average, then apply the mode's correction. */
function stepSim(prev: Sim, mode: Mode): Sim {
  const { shares, biases } = prev;

  const weights = shares.map((s, i) => {
    const base = Math.pow(s, RICH) + FLOOR;
    return mode === "bias" ? base * Math.exp(biases[i] ?? 0) : base;
  });
  const total = weights.reduce((a, b) => a + b, 0);

  const counts = Array<number>(EXPERTS).fill(0);
  for (let t = 0; t < BATCH; t++) {
    let roll = Math.random() * total;
    let pick = EXPERTS - 1;
    for (let i = 0; i < EXPERTS; i++) {
      roll -= weights[i] ?? 0;
      if (roll <= 0) {
        pick = i;
        break;
      }
    }
    counts[pick] = (counts[pick] ?? 0) + 1;
  }

  let next = shares.map((s, i) => s * (1 - EMA) + ((counts[i] ?? 0) / BATCH) * EMA);

  // Auxiliary loss: a corrective pressure relaxing shares toward uniform.
  if (mode === "aux") {
    next = next.map((s) => s + AUX_PULL * (TARGET - s));
  }

  const sum = next.reduce((a, b) => a + b, 0) || 1;
  next = next.map((s) => s / sum);

  // Bias nudges: overloaded experts get pushed DOWN, starved ones UP. The
  // bias only steers selection — the loss is never touched.
  let nextBiases = biases;
  if (mode === "bias") {
    nextBiases = biases.map((b, i) => {
      const s = next[i] ?? TARGET;
      if (s > TARGET * 1.05) return Math.max(-BIAS_MAX, b - BIAS_STEP);
      if (s < TARGET * 0.95) return Math.min(BIAS_MAX, b + BIAS_STEP);
      return b;
    });
  }

  return { shares: next, biases: nextBiases, steps: prev.steps + 1 };
}

const MODES: { id: Mode; label: string }[] = [
  { id: "none", label: "No balancing" },
  { id: "aux", label: "Auxiliary loss (Switch)" },
  { id: "bias", label: "Bias nudges (DeepSeek, aux-loss-free)" },
];

const CAPTIONS: Record<Mode, string> = {
  none:
    "Nothing pushes back: favored experts get more gradient, improve, and get picked even more. Watch the router collapse.",
  aux: "A small penalty (α ≈ 0.01) for imbalance keeps every expert alive.",
  bias:
    "DeepSeek-V3 drops the auxiliary loss entirely — a per-expert bias used only for selection is nudged after each step.",
};

export default function LoadBalancer() {
  const [mode, setMode] = useState<Mode>("none");
  const [running, setRunning] = useState(false);
  const [sim, setSim] = useState<Sim>(initialSim);
  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  useEffect(() => {
    if (!running) return;
    if (reduce) {
      // No gradual animation: jump straight to this mode's steady state.
      setSim(steadyState(mode));
      setRunning(false);
      return;
    }
    const id = window.setInterval(() => {
      setSim((prev) => stepSim(prev, mode));
    }, TICK_MS);
    return () => window.clearInterval(id);
  }, [running, reduce, mode]);

  const status = useMemo(() => {
    const { shares, steps } = sim;
    let top = 0;
    shares.forEach((s, i) => {
      if (s > (shares[top] ?? 0)) top = i;
    });
    const topPct = Math.round((shares[top] ?? 0) * 100);
    const deadCount = shares.filter((s) => s < DEAD).length;
    const spread = Math.max(...shares) - Math.min(...shares);
    if (spread < 0.04 && deadCount === 0) {
      return `Step ${steps} — routing is balanced; all 8 experts near 12.5% of tokens.`;
    }
    const deadText =
      deadCount === 0
        ? "all 8 experts alive"
        : `${deadCount} expert${deadCount === 1 ? " is" : "s are"} dead`;
    return `Step ${steps} — expert ${top + 1} is taking ${topPct}% of tokens; ${deadText}.`;
  }, [sim]);

  const barTrans = reduce ? "none" : "height 160ms ease, background 160ms ease";

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex flex-wrap gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              type="button"
              aria-pressed={active}
              onClick={() => {
                setMode(m.id);
                setRunning(true);
              }}
              className={
                "rounded-lg border px-3 py-1.5 text-xs font-semibold transition-colors " +
                (active
                  ? "border-[var(--color-data-500)] bg-[var(--color-surface-2)] text-[var(--color-fg)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {m.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs italic text-[var(--color-muted)]">
        {CAPTIONS[mode]}
        {mode === "bias" && (
          <>
            {" "}
            <span className="not-italic text-[var(--color-shared-400)]">▲</span> starved, bias
            nudged up · <span className="not-italic text-[var(--color-weight-400)]">▼</span>{" "}
            overloaded, nudged down.
          </>
        )}
      </p>

      <div
        className="flex flex-1 items-end gap-2 sm:gap-3"
        role="img"
        aria-label="Utilization bars for 8 experts, showing the fraction of recent tokens routed to each"
      >
        {sim.shares.map((share, i) => {
          const dead = share < DEAD;
          const overloaded = share > TARGET * 2;
          const bias = sim.biases[i] ?? 0;
          const fill = dead
            ? "var(--color-line)"
            : overloaded
              ? "var(--color-weight-500)"
              : "var(--color-data-500)";
          return (
            <div key={i} className="flex min-w-0 flex-1 flex-col items-center gap-1">
              <span
                className={
                  "font-mono text-[10px] tabular-nums " +
                  (dead ? "text-[var(--color-line)]" : "text-[var(--color-muted)]")
                }
              >
                {Math.round(share * 100)}%
              </span>
              <div className="flex h-32 w-full items-end overflow-hidden rounded-md border border-[var(--color-line)] bg-[var(--color-surface)] sm:h-40">
                <div
                  className="w-full rounded-t-sm"
                  style={{
                    height: `${Math.max(share * 100, 2)}%`,
                    background: fill,
                    transition: barTrans,
                  }}
                />
              </div>
              <span
                className={
                  "font-mono text-[10px] " +
                  (dead ? "text-[var(--color-line)]" : "text-[var(--color-fg)]")
                }
              >
                E{i + 1}
              </span>
              <span className="h-3.5 font-mono text-[10px] leading-none">
                {mode === "bias" ? (
                  bias > 0.02 ? (
                    <span className="text-[var(--color-shared-400)]">▲</span>
                  ) : bias < -0.02 ? (
                    <span className="text-[var(--color-weight-400)]">▼</span>
                  ) : (
                    <span className="text-[var(--color-muted)]">·</span>
                  )
                ) : dead ? (
                  <span className="italic text-[var(--color-line)]">dead</span>
                ) : (
                  " "
                )}
              </span>
            </div>
          );
        })}
      </div>

      <div className="flex flex-wrap items-center gap-3 border-t border-[var(--color-line)] pt-3">
        <button
          type="button"
          onClick={() => setRunning((r) => !r)}
          className="rounded-lg bg-[var(--color-unique-500)] px-4 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          {running ? "Pause" : "Run"}
        </button>
        <button
          type="button"
          onClick={() => {
            setSim(initialSim());
            setRunning(false);
          }}
          className="rounded-lg border border-[var(--color-line)] px-4 py-1.5 text-sm font-semibold text-[var(--color-fg)] hover:bg-[var(--color-surface-2)]"
        >
          Reset
        </button>
        <span className="ml-auto font-mono text-xs tabular-nums text-[var(--color-muted)]">
          training steps: <span className="text-[var(--color-fg)]">{sim.steps}</span>
        </span>
      </div>

      <p className="text-xs text-[var(--color-muted)]" aria-live="polite">
        {status}
      </p>

      <p className="text-[10px] text-[var(--color-muted)]">
        Router collapse was identified in the first sparse-MoE paper (Shazeer et al., 2017). One
        line of defense per era: noisy top-k (2017), auxiliary loss (Switch, 2021), aux-loss-free
        bias (DeepSeek, 2024). (Capacity factors and token dropping are a third, now-fading tool.)
      </p>
    </div>
  );
}
