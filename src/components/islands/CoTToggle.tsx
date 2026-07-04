import { useEffect, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** "Think step by step" on 23 × 17. Direct answering fails; a chain of thought
 *  succeeds — and the token counter shows why: each token is another forward
 *  pass, i.e. more compute spent before committing to an answer. */

const COT_STEPS = ["23 × 17", "= 23 × (10 + 7)", "= (23 × 10) + (23 × 7)", "= 230 + 161", "= 391  ✓"];
const DIRECT_ANSWER = "= 371  ✗";
const COT_TOKENS = 27;
const DIRECT_TOKENS = 4;

export default function CoTToggle() {
  const [cot, setCot] = useState(false);
  const [revealed, setRevealed] = useState(0);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  useEffect(() => {
    if (!cot) {
      setRevealed(0);
      return;
    }
    if (reduce) {
      setRevealed(COT_STEPS.length);
      return;
    }
    setRevealed(1);
    const id = window.setInterval(() => {
      setRevealed((r) => {
        if (r >= COT_STEPS.length) {
          window.clearInterval(id);
          return r;
        }
        return r + 1;
      });
    }, 620);
    return () => window.clearInterval(id);
  }, [cot, reduce]);

  const tokens = cot ? Math.round((revealed / COT_STEPS.length) * COT_TOKENS) : DIRECT_TOKENS;
  const done = !cot || revealed >= COT_STEPS.length;

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-center justify-between">
        <span className="text-sm text-[var(--color-muted)]">Prompt: what is 23 × 17?</span>
        <button
          type="button"
          onClick={() => setCot((v) => !v)}
          aria-pressed={cot}
          className={
            "flex items-center gap-2 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors " +
            (cot
              ? "border-transparent bg-[var(--color-unique-500)] text-white"
              : "border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
          }
        >
          <span className={"h-2 w-2 rounded-full " + (cot ? "bg-white" : "bg-[var(--color-line)]")} />
          think step by step
        </button>
      </div>

      <div className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-4 font-mono text-lg">
        {!cot ? (
          <div>
            <div className="text-[var(--color-muted)]">23 × 17</div>
            <div className="mt-2 text-[var(--color-unique-400)]">{DIRECT_ANSWER}</div>
            <p className="mt-4 font-sans text-sm text-[var(--color-muted)]">
              Blurting the answer in one shot, the model often gets big multiplications wrong — it
              has no room to work.
            </p>
          </div>
        ) : (
          <div className="space-y-1.5" aria-live="polite">
            {COT_STEPS.slice(0, revealed).map((s, i) => (
              <div
                key={i}
                className={i === COT_STEPS.length - 1 ? "text-[var(--color-shared-400)]" : "text-[var(--color-fg)]"}
              >
                {s}
              </div>
            ))}
            {!done && <div className="text-[var(--color-line)]">▍</div>}
            {done && (
              <p className="mt-4 font-sans text-sm text-[var(--color-muted)]">
                Working through intermediate steps, it gets it right. The reasoning trace is a
                scratchpad it can lean on.
              </p>
            )}
          </div>
        )}
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
        <div className="flex items-center justify-between text-xs text-[var(--color-muted)]">
          <span>forward passes (tokens generated)</span>
          <span className="font-mono text-[var(--color-data-400)]">{tokens}</span>
        </div>
        <div className="mt-1.5 h-2 overflow-hidden rounded bg-[var(--color-surface)]">
          <div
            className="h-full rounded bg-[var(--color-data-500)]"
            style={{
              width: `${(tokens / COT_TOKENS) * 100}%`,
              transition: reduce ? "none" : "width 300ms ease",
            }}
          />
        </div>
        <p className="mt-2 text-xs text-[var(--color-muted)]">
          Each generated token is another pass through the whole network. More tokens = more
          computation the model can spend <em>thinking</em> before it answers.
        </p>
      </div>
    </div>
  );
}
