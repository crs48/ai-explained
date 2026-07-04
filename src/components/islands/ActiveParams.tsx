import { useEffect, useState } from "react";
import data from "../../data/moe.json";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Total vs active parameters across real MoE models. Memory scales with the
 *  TOTAL parameter count; per-token compute scales with the ACTIVE count. Bars
 *  are scaled relative to the selected model's total so every model reads well. */

type MoeModel = (typeof data.models)[number];

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

function releaseOrder(released: string): number {
  const [mon = "", year = ""] = released.split(" ");
  return Number(year) * 12 + MONTHS.indexOf(mon);
}

function ratio(m: MoeModel): number {
  return m.active / m.total;
}

function formatB(billions: number): string {
  return `${Number.isInteger(billions) ? billions : billions.toFixed(1)}B`;
}

function formatPct(m: MoeModel): string {
  const pct = ratio(m) * 100;
  return `~${pct >= 10 ? Math.round(pct).toString() : pct.toFixed(1)}%`;
}

function takeaway(m: MoeModel): string {
  const active = Math.round(m.active);
  const total = Math.round(m.total);
  if (m.rumor) {
    return `Rumored to run at the compute cost of a ~${active}B model while knowing like a ${total}B one — if the leak was accurate.`;
  }
  return `Runs at the speed and compute cost of a ~${active}B model while knowing like a ${total}B one.`;
}

const DEFAULT_INDEX = Math.max(
  0,
  data.models.findIndex((m) => m.name.includes("Mixtral")),
);

const TREND: MoeModel[] = [...data.models].sort(
  (a, b) => releaseOrder(a.released) - releaseOrder(b.released),
);
const MAX_RATIO = Math.max(...TREND.map(ratio), 0.001);

function RumorBadge() {
  return (
    <span className="rounded border border-[var(--color-unique-400)] px-1 py-px text-[9px] font-bold uppercase tracking-wide text-[var(--color-unique-400)]">
      rumor
    </span>
  );
}

export default function ActiveParams() {
  const [selectedIndex, setSelectedIndex] = useState(DEFAULT_INDEX);
  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const model = data.models[selectedIndex] ?? data.models[0];
  if (!model) return null;

  const activePct = ratio(model) * 100;
  const barTransition = reduce ? "none" : "width 300ms ease";
  const sharedLabel =
    model.shared > 0
      ? `${model.shared} shared expert${model.shared === 1 ? "" : "s"}`
      : "no shared expert";

  return (
    <div className="flex h-full w-full flex-col gap-4">
      {/* Model picker */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Pick a mixture-of-experts model">
        {data.models.map((m, i) => {
          const selected = i === selectedIndex;
          return (
            <button
              key={m.name}
              type="button"
              aria-pressed={selected}
              onClick={() => setSelectedIndex(i)}
              className={
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs transition-colors " +
                (selected
                  ? "border-[var(--color-data-500)] bg-[var(--color-surface-2)] font-semibold text-[var(--color-fg)]"
                  : "border-[var(--color-line)] text-[var(--color-muted)] hover:border-[var(--color-data-400)] hover:text-[var(--color-fg)]")
              }
            >
              {m.name}
              {m.rumor && <RumorBadge />}
            </button>
          );
        })}
      </div>

      {/* Two bars on a shared scale: total = full width, active = fraction of it */}
      <div
        className="space-y-3"
        role="img"
        aria-label={`${model.name}: ${formatB(model.total)} total parameters in memory, ${formatB(model.active)} active per token — ${formatPct(model)} of the model`}
      >
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--color-weight-400)]">Total parameters</span>
            <span className="text-[var(--color-muted)]">what you must load in memory</span>
          </div>
          <div className="mt-1 flex h-6 items-center gap-2">
            <div className="h-full flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
              <div
                className="h-full rounded"
                style={{ width: "100%", background: "var(--color-weight-500)", transition: barTransition }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--color-fg)]">
              {formatB(model.total)}
            </span>
          </div>
        </div>
        <div>
          <div className="flex items-baseline justify-between gap-2 text-xs">
            <span className="font-semibold text-[var(--color-shared-400)]">Active per token</span>
            <span className="text-[var(--color-muted)]">what one token pays for in compute</span>
          </div>
          <div className="mt-1 flex h-6 items-center gap-2">
            <div className="h-full flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
              <div
                className="h-full rounded"
                style={{
                  width: `${activePct}%`,
                  background: "var(--color-shared-500)",
                  transition: barTransition,
                }}
              />
            </div>
            <span className="w-14 shrink-0 text-right font-mono text-xs tabular-nums text-[var(--color-fg)]">
              {formatB(model.active)}
            </span>
          </div>
        </div>
      </div>

      {/* Big readouts */}
      <div className="grid grid-cols-3 gap-3 text-center">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
          <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-weight-400)]">
            {formatB(model.total)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">total — sits in memory</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
          <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-shared-400)]">
            {formatB(model.active)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">active — per-token compute</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
          <div className="font-mono text-2xl font-bold tabular-nums text-[var(--color-data-400)]">
            {formatPct(model)}
          </div>
          <div className="mt-0.5 text-[11px] text-[var(--color-muted)]">of the model works on each token</div>
        </div>
      </div>

      {/* Metadata + rumor caveat */}
      <div className="space-y-1">
        <p className="text-xs text-[var(--color-muted)]">
          {model.experts} experts · top-{model.topK} · {sharedLabel} · released {model.released}
        </p>
        {model.rumor && (
          <p className="flex items-center gap-2 text-xs text-[var(--color-unique-400)]">
            <RumorBadge />
            <span>Unconfirmed leak (SemiAnalysis) — OpenAI never confirmed these figures.</span>
          </p>
        )}
      </div>

      {/* Per-model takeaway */}
      <div aria-live="polite" className="space-y-1">
        <p className="text-sm text-[var(--color-fg)]">{takeaway(model)}</p>
        {model.name.includes("Mixtral") && (
          <p className="text-xs italic text-[var(--color-muted)]">
            Fun fact: ‘8×7B’ ≠ 56B — the experts share attention, so the real total is 46.7B.
          </p>
        )}
      </div>

      {/* Trend footer with a tiny ratio sparkline */}
      <div className="flex items-end justify-between gap-4 border-t border-[var(--color-line)] pt-3">
        <p className="text-xs text-[var(--color-muted)]">
          The trend: Mixtral (2023) activated ~28% of itself per token; DeepSeek-V3 ~5.5%; gpt-oss
          ~4.4%. The industry keeps pushing the ratio down — more capacity, same compute.
        </p>
        <div
          className="flex h-8 shrink-0 items-end gap-1"
          role="img"
          aria-label="Active-parameter ratio by release date — the share of the model used per token keeps shrinking"
        >
          {TREND.map((m) => (
            <div
              key={m.name}
              title={`${m.name} (${m.released}): ${formatPct(m)} active${m.rumor ? " — rumor" : ""}`}
              className="w-2 rounded-sm"
              style={{
                height: `${Math.max((ratio(m) / MAX_RATIO) * 100, 10)}%`,
                background: m.rumor
                  ? "var(--color-unique-400)"
                  : m.name === model.name
                    ? "var(--color-shared-500)"
                    : "var(--color-shared-400)",
              }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
