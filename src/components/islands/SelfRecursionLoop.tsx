import { useEffect, useRef, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** The unique core of the reasoning track. A plain LLM and a reasoning LLM run
 *  the SAME autoregressive loop on the same question — but the reasoning model
 *  first generates a long chain of thought (re-reading its own tokens) before
 *  answering. Toggle how vendors expose those reasoning tokens. */

const QUESTION = "Is 121 a prime number?";
const PLAIN_ANSWER = "Yes, 121 is prime.";
const THOUGHTS = [
  "Let me check if 121 is prime.",
  "It's odd — not divisible by 2, 3, or 5.",
  "Try 7: 7×17=119, 7×18=126. No.",
  "Try 11: 11×11 = 121.",
  "So 121 = 11² — it has a divisor.",
];
const REASONING_ANSWER = "No — 121 = 11², so it isn't prime.";
const TOKENS_PER_THOUGHT = 9;

type Vendor = "openai" | "deepseek";

export default function SelfRecursionLoop() {
  const [vendor, setVendor] = useState<Vendor>("deepseek");
  const [running, setRunning] = useState(false);
  const [step, setStep] = useState(0); // thoughts revealed
  const [answered, setAnswered] = useState(false);
  const [reduce, setReduce] = useState(false);
  const timer = useRef<number | undefined>(undefined);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  useEffect(() => () => window.clearInterval(timer.current), []);

  function run() {
    window.clearInterval(timer.current);
    setAnswered(false);
    setRunning(true);
    if (reduce) {
      setStep(THOUGHTS.length);
      setAnswered(true);
      return;
    }
    setStep(0);
    timer.current = window.setInterval(() => {
      setStep((s) => {
        if (s >= THOUGHTS.length) {
          window.clearInterval(timer.current);
          setAnswered(true);
          return s;
        }
        return s + 1;
      });
    }, 750);
  }

  function reset() {
    window.clearInterval(timer.current);
    setRunning(false);
    setStep(0);
    setAnswered(false);
  }

  const tokens = step * TOKENS_PER_THOUGHT;

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="font-mono text-sm text-[var(--color-fg)]">{QUESTION}</p>
        <div className="inline-flex overflow-hidden rounded-lg border border-[var(--color-line)] text-xs">
          {(["deepseek", "openai"] as Vendor[]).map((v) => (
            <button
              key={v}
              type="button"
              onClick={() => setVendor(v)}
              aria-pressed={vendor === v}
              className={
                "px-2.5 py-1 " +
                (vendor === v
                  ? "bg-[var(--color-unique-500)] text-white"
                  : "bg-[var(--color-surface-2)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
            >
              {v === "deepseek" ? "DeepSeek-R1 (shows CoT)" : "OpenAI o-series (hides CoT)"}
            </button>
          ))}
        </div>
      </div>

      <div className="grid flex-1 grid-cols-2 gap-3">
        {/* Plain LLM */}
        <div className="flex flex-col rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-muted)]">Plain LLM</p>
          <div className="mt-2 flex-1 font-mono text-sm">
            {running && (
              <p className="text-[var(--color-fg)]">
                {PLAIN_ANSWER}
                {answered && <span className="ml-1 text-[var(--color-unique-400)]">✗</span>}
              </p>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-muted)]">Answers immediately — no room to check.</p>
        </div>

        {/* Reasoning LLM */}
        <div className="flex flex-col rounded-xl border p-3" style={{ borderColor: "var(--color-unique-500)", background: "color-mix(in oklab, var(--color-unique-500) 8%, var(--color-surface))" }}>
          <div className="flex items-center justify-between">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--color-unique-400)]">Reasoning LLM</p>
            {running && (
              <span className="font-mono text-[10px] text-[var(--color-muted)]">
                {tokens} reasoning tokens
              </span>
            )}
          </div>

          <div className="mt-2 flex-1 text-sm">
            {running && vendor === "deepseek" && (
              <div className="font-mono text-xs text-[var(--color-muted)]" aria-live="polite">
                <div className="text-[var(--color-line)]">&lt;think&gt;</div>
                {THOUGHTS.slice(0, step).map((t, i) => (
                  <div key={i} className="pl-2">
                    ↳ {t}
                  </div>
                ))}
                {!answered && <div className="pl-2 text-[var(--color-line)]">▍</div>}
                {answered && <div className="text-[var(--color-line)]">&lt;/think&gt;</div>}
              </div>
            )}
            {running && vendor === "openai" && (
              <div className="font-mono text-xs" aria-live="polite">
                <div className="rounded border border-dashed border-[var(--color-line)] bg-[var(--color-surface)] p-2 text-[var(--color-muted)]">
                  🔒 reasoning tokens hidden — {tokens} generated, billed as output
                </div>
                {answered && (
                  <div className="mt-1 pl-1 italic text-[var(--color-muted)]">
                    summary: “checked small divisors; found 11 × 11 = 121.”
                  </div>
                )}
              </div>
            )}
            {answered && (
              <p className="mt-2 font-mono text-sm text-[var(--color-shared-400)]">
                {REASONING_ANSWER} <span className="text-[var(--color-shared-400)]">✓</span>
              </p>
            )}
          </div>
          <p className="text-[10px] text-[var(--color-unique-400)]">
            Reads its own thoughts and continues — the same loop, run long.
          </p>
        </div>
      </div>

      <div className="flex items-center justify-between gap-2">
        <p className="text-xs text-[var(--color-muted)]">
          Both are the same autoregressive next-token machine. The reasoning model was just trained
          to <strong className="text-[var(--color-fg)]">think first</strong>.
        </p>
        <div className="flex gap-2">
          <button
            type="button"
            onClick={run}
            className="rounded-lg bg-[var(--color-unique-500)] px-3 py-1.5 text-sm font-semibold text-white hover:brightness-110"
          >
            {running ? "Re-run" : "Run both ▶"}
          </button>
          {running && (
            <button
              type="button"
              onClick={reset}
              className="rounded-lg border border-[var(--color-line)] px-3 py-1.5 text-sm text-[var(--color-muted)] hover:text-[var(--color-fg)]"
            >
              Reset
            </button>
          )}
        </div>
      </div>
    </div>
  );
}
