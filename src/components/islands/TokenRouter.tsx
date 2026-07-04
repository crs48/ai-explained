import { useEffect, useRef, useState } from "react";
import data from "../../data/moe.json";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** Route a sentence through an MoE layer, token by token: router logits →
 *  softmax over the top-2 (Mixtral's formulation; the rest are cut to −∞) →
 *  a weighted merge of two experts. Then a reveal: color every token by its
 *  #1 expert — the clusters are syntactic (punctuation, identifiers), not
 *  topical. Routing values are curated to match the Mixtral paper's findings. */

const DEMO = data.routingDemo;
const N = DEMO.expertNames.length;

const EXPERT_COLORS = ["#2f7ff0", "#14b8a6", "#f5a623", "#ec4899", "#8b5cf6", "#22c55e", "#e8956b", "#5aa9ff"];

/** Deterministic display logits: top-2 from the JSON gates, the rest a fixed
 *  low pattern by (token, expert) index — pure integer arithmetic, SSR-safe. */
function logitsFor(tokenIdx: number): number[] {
  const a = DEMO.assignments[tokenIdx];
  const out: number[] = [];
  for (let e = 0; e < N; e++) {
    const k = a.top.indexOf(e);
    if (k === 0) out.push(2.0 + a.gates[0]);
    else if (k === 1) out.push(2.0 + a.gates[1] * 0.5);
    else out.push(0.2 + (((tokenIdx * 7 + e * 13) % 10) / 10) * 0.9);
  }
  return out;
}

function show(tok: string) {
  return tok.replace(/ /g, "·");
}

export default function TokenRouter() {
  const [step, setStep] = useState(0);
  const [reveal, setReveal] = useState(false);
  const [reduce, setReduce] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);
  useEffect(() => () => window.clearInterval(timer.current), []);

  const a = DEMO.assignments[step];
  const logits = logitsFor(step);
  const maxLogit = Math.max(...logits);

  function play() {
    window.clearInterval(timer.current);
    if (reduce) {
      setStep(DEMO.assignments.length - 1);
      setReveal(true);
      return;
    }
    setReveal(false);
    setStep(0);
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= DEMO.assignments.length - 1) {
          window.clearInterval(timer.current);
          setReveal(true);
          return s;
        }
        return s + 1;
      });
    }, 900);
  }

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* sentence */}
      <div className="flex flex-wrap gap-1 font-mono text-sm" aria-label="Tokens being routed">
        {DEMO.sentence.map((tok, i) => {
          const done = reveal || i < step;
          const current = !reveal && i === step;
          const expert = DEMO.assignments[i].top[0];
          return (
            <button
              key={i}
              type="button"
              onClick={() => {
                window.clearInterval(timer.current);
                setReveal(false);
                setStep(i);
              }}
              aria-pressed={current}
              className="rounded px-1.5 py-0.5 transition-colors"
              style={{
                background: done ? EXPERT_COLORS[expert] + (reveal ? "dd" : "55") : current ? "var(--color-surface-2)" : "transparent",
                border: current ? "1.5px solid var(--color-unique-400)" : "1.5px solid var(--color-line)",
                color: done && reveal ? "#0b1020" : "var(--color-fg)",
              }}
            >
              {show(tok)}
            </button>
          );
        })}
      </div>

      {!reveal ? (
        <div className="flex flex-1 flex-col gap-2">
          <p className="text-xs text-[var(--color-muted)]">
            Routing <strong className="font-mono text-[var(--color-fg)]">{show(a.token)}</strong> —
            router logits, softmax over the <strong className="text-[var(--color-fg)]">top-2</strong>{" "}
            (the rest are cut to −∞):
          </p>
          <div className="flex-1 space-y-1" role="img" aria-label={`Router scores for token ${a.token}`}>
            {DEMO.expertNames.map((name, e) => {
              const k = a.top.indexOf(e);
              const kept = k >= 0;
              const gate = kept ? a.gates[k] : 0;
              return (
                <div key={e} className="flex items-center gap-2">
                  <span
                    className="w-7 shrink-0 rounded px-1 text-center font-mono text-[10px] font-bold"
                    style={{ background: EXPERT_COLORS[e] + "33", color: "var(--color-fg)", border: `1px solid ${EXPERT_COLORS[e]}` }}
                  >
                    {name}
                  </span>
                  <div className="relative h-4 flex-1 overflow-hidden rounded bg-[var(--color-surface)]">
                    <div
                      className="h-full rounded"
                      style={{
                        width: `${(logits[e] / maxLogit) * 100}%`,
                        background: kept ? EXPERT_COLORS[e] : "var(--color-line)",
                        opacity: kept ? 1 : 0.45,
                        transition: reduce ? "none" : "width 200ms ease",
                      }}
                    />
                    {!kept && (
                      <span className="absolute inset-0 flex items-center pl-2 text-[9px] text-[var(--color-muted)] line-through">
                        cut → −∞
                      </span>
                    )}
                  </div>
                  <span className="w-14 shrink-0 text-right font-mono text-[10px] tabular-nums" style={{ color: kept ? "var(--color-fg)" : "var(--color-line)" }}>
                    {kept ? `g=${gate.toFixed(2)}` : "0"}
                  </span>
                </div>
              );
            })}
          </div>
          <p className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2 font-mono text-xs text-[var(--color-fg)]" aria-live="polite">
            y = {a.gates[0].toFixed(2)}·{DEMO.expertNames[a.top[0]]}(x) + {a.gates[1].toFixed(2)}·{DEMO.expertNames[a.top[1]]}(x)
            <span className="ml-2 text-[var(--color-muted)]">— the other {N - 2} experts cost nothing</span>
          </p>
        </div>
      ) : (
        <div className="flex flex-1 flex-col justify-center gap-2" aria-live="polite">
          <p className="text-sm text-[var(--color-fg)]">
            Every token colored by its <strong>#1 expert</strong>. See the pattern? Punctuation{" "}
            <span className="font-mono">( ) , :</span> clusters on one expert; identifiers{" "}
            <span className="font-mono">a b</span> on another; keywords on a third.
          </p>
          <p className="text-xs text-[var(--color-muted)]">
            That matches what Mixtral's authors found when they analyzed real routing:{" "}
            <strong className="text-[var(--color-fg)]">no obvious topic specialization</strong> —
            experts cluster by <em>syntax and token type</em>, and consecutive tokens often share
            experts. There is no "math expert" or "law expert." (Values here are illustrative,
            arranged to match those findings.)
          </p>
        </div>
      )}

      <div className="flex items-center justify-between gap-2 border-t border-[var(--color-line)] pt-2">
        <div className="flex gap-1.5">
          <button
            type="button"
            onClick={() => { window.clearInterval(timer.current); setReveal(false); setStep((s) => Math.max(0, s - 1)); }}
            className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            ← prev
          </button>
          <button
            type="button"
            onClick={() => { window.clearInterval(timer.current); if (step >= DEMO.assignments.length - 1) setReveal(true); else setStep((s) => s + 1); }}
            className="rounded-md border border-[var(--color-line)] px-2 py-1 text-xs text-[var(--color-muted)] hover:text-[var(--color-fg)]"
          >
            next →
          </button>
        </div>
        <button
          type="button"
          onClick={reveal ? () => { setReveal(false); setStep(0); } : play}
          className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
        >
          {reveal ? "Restart" : "Route them all ▶"}
        </button>
      </div>
    </div>
  );
}
