import { useEffect, useMemo, useState } from "react";
import example from "../../data/example.json";
import { softmax } from "../../lib/sampling";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Live temperature + top-p (nucleus) sampling over a fixed next-token
 *  distribution. Bars are real softmax probabilities that reshape as you drag. */

const CANDIDATES = example.nextToken.candidates;

function label(tok: string) {
  return tok.replace(/^ /, "·");
}

export default function SamplingPlayground() {
  const [temperature, setTemperature] = useState(0.8);
  const [topP, setTopP] = useState(1);
  const [sampled, setSampled] = useState<string | null>(null);
  const [rolls, setRolls] = useState(0);
  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const rows = useMemo(() => {
    const probs = softmax(
      CANDIDATES.map((c) => c.logit),
      temperature,
    );
    const order = CANDIDATES.map((c, i) => ({ token: c.token, prob: probs[i] })).sort(
      (a, b) => b.prob - a.prob,
    );
    let cum = 0;
    return order.map((o) => {
      const keep = cum < topP;
      cum += o.prob;
      return { ...o, keep };
    });
  }, [temperature, topP]);

  const greedy = rows[0]?.token;
  const maxProb = Math.max(...rows.map((r) => r.prob), 0.001);

  function sample() {
    const kept = rows.filter((r) => r.keep);
    const mass = kept.reduce((a, b) => a + b.prob, 0) || 1;
    let roll = Math.random() * mass;
    let pick = kept[kept.length - 1]?.token ?? rows[0].token;
    for (const r of kept) {
      roll -= r.prob;
      if (roll <= 0) {
        pick = r.token;
        break;
      }
    }
    setSampled(pick);
    setRolls((n) => n + 1);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <p className="font-mono text-sm text-[var(--color-muted)]">
        {example.nextToken.prompt} <span className="text-[var(--color-line)]">▍</span>
      </p>

      <div className="flex-1 space-y-1.5" role="img" aria-label="Next-token probability distribution">
        {rows.map((r) => {
          const isSampled = sampled === r.token;
          return (
            <div key={r.token} className="flex items-center gap-2">
              <span
                className={
                  "w-16 shrink-0 text-right font-mono text-xs " +
                  (r.keep ? "text-[var(--color-fg)]" : "text-[var(--color-line)] line-through")
                }
              >
                {label(r.token)}
              </span>
              <div className="relative h-5 flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
                <div
                  className="h-full rounded"
                  style={{
                    width: `${(r.prob / maxProb) * 100}%`,
                    background: r.keep
                      ? isSampled
                        ? "var(--color-unique-500)"
                        : "var(--color-data-500)"
                      : "var(--color-line)",
                    transition: reduce ? "none" : "width 180ms ease, background 180ms ease",
                  }}
                />
                {isSampled && (
                  <span className="absolute right-1 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white">
                    ← sampled
                  </span>
                )}
              </div>
              <span className="w-12 shrink-0 font-mono text-xs tabular-nums text-[var(--color-muted)]">
                {(r.prob * 100).toFixed(1)}%
              </span>
            </div>
          );
        })}
        <p className="pl-16 pt-1 text-xs italic text-[var(--color-muted)]">
          {example.nextToken.tailNote}
        </p>
      </div>

      <div className="grid gap-3 border-t border-[var(--color-line)] pt-3 sm:grid-cols-2">
        <label className="text-xs">
          <span className="flex justify-between text-[var(--color-muted)]">
            <span>Temperature</span>
            <span className="font-mono text-[var(--color-fg)]">
              {temperature === 0 ? "0 (greedy)" : temperature.toFixed(2)}
            </span>
          </span>
          <input
            type="range"
            min={0}
            max={2}
            step={0.05}
            value={temperature}
            onChange={(e) => setTemperature(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-data-500)]"
          />
        </label>
        <label className="text-xs">
          <span className="flex justify-between text-[var(--color-muted)]">
            <span>Top-p (nucleus)</span>
            <span className="font-mono text-[var(--color-fg)]">{topP.toFixed(2)}</span>
          </span>
          <input
            type="range"
            min={0.05}
            max={1}
            step={0.01}
            value={topP}
            onChange={(e) => setTopP(Number(e.target.value))}
            className="mt-1 w-full accent-[var(--color-unique-500)]"
          />
        </label>
      </div>

      <div className="flex items-center justify-between gap-3">
        <button
          type="button"
          onClick={sample}
          className="rounded-lg bg-[var(--color-unique-500)] px-4 py-2 text-sm font-semibold text-white hover:brightness-110"
        >
          Sample! 🎲
        </button>
        <p className="text-xs text-[var(--color-muted)]" aria-live="polite">
          greedy pick: <span className="font-mono text-[var(--color-fg)]">{label(greedy ?? "")}</span>
          {rolls > 0 && (
            <>
              <span className="mx-2 text-[var(--color-line)]">·</span>
              {rolls} sample{rolls === 1 ? "" : "s"} drawn
            </>
          )}
        </p>
      </div>
    </div>
  );
}
