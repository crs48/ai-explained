import { useEffect, useMemo, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** How reasoning models are trained. The centerpiece is the "aha moment"
 *  scrubber: as RL training proceeds, DeepSeek-R1-Zero's answers get longer, it
 *  starts saying "Wait…" (emergent self-correction), and AIME accuracy climbs
 *  15.6% → 71.0% — all from reinforcement learning with verifiable rewards. */

const AIME_START = 15.6;
const AIME_END = 71.0;

function smooth(t: number) {
  return t * t * (3 - 2 * t);
}

function transcript(p: number): { text: string; wait: boolean } {
  if (p < 0.34) return { text: "121 is prime.", wait: false };
  if (p < 0.67)
    return {
      text: "121 is odd, not divisible by 2, 3, or 5. It looks prime.",
      wait: false,
    };
  return {
    text: "121 is odd… not divisible by 2, 3, 5, 7. Wait — 11 × 11 = 121. So it's not prime.",
    wait: true,
  };
}

export default function TrainingReasoning() {
  const [progress, setProgress] = useState(0.15);
  const [reduce, setReduce] = useState(false);

  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const { accuracy, tokens, reflections, script } = useMemo(() => {
    const e = smooth(progress);
    return {
      accuracy: AIME_START + (AIME_END - AIME_START) * e,
      tokens: Math.round(40 + e * (1200 - 40)),
      reflections: Math.floor(e * 7),
      script: transcript(progress),
    };
  }, [progress]);

  const trans = reduce ? "none" : "width 200ms ease";

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <label className="text-xs">
        <span className="flex justify-between text-[var(--color-muted)]">
          <span>RL training progress (DeepSeek-R1-Zero, pure RL — no supervised warm-up)</span>
        </span>
        <input
          type="range"
          min={0}
          max={1}
          step={0.01}
          value={progress}
          onChange={(e) => setProgress(Number(e.target.value))}
          aria-label="RL training progress"
          className="mt-1 w-full accent-[var(--color-unique-500)]"
        />
      </label>

      <div className="grid grid-cols-3 gap-2 text-center" aria-live="polite">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-shared-400)]">{accuracy.toFixed(1)}%</div>
          <div className="text-[10px] text-[var(--color-muted)]">AIME 2024 accuracy</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-data-400)]">{tokens}</div>
          <div className="text-[10px] text-[var(--color-muted)]">tokens / answer</div>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2">
          <div className="font-mono text-lg text-[var(--color-unique-400)]">{reflections}</div>
          <div className="text-[10px] text-[var(--color-muted)]">“wait / reconsider”s</div>
        </div>
      </div>

      <div className="flex-1 rounded-xl border border-[var(--color-line)] bg-[var(--color-surface)] p-3">
        <div className="text-[10px] uppercase tracking-wide text-[var(--color-muted)]">
          a sample answer at this stage
        </div>
        <p className="mt-1 font-mono text-sm text-[var(--color-fg)]">
          {script.wait ? (
            <>
              {script.text.split("Wait").map((part, i) =>
                i === 0 ? (
                  <span key={i}>{part}</span>
                ) : (
                  <span key={i}>
                    <mark className="rounded bg-[var(--color-unique-500)] px-1 text-white">Wait</mark>
                    {part}
                  </span>
                ),
              )}
            </>
          ) : (
            script.text
          )}
        </p>
        <div className="mt-2 h-1.5 overflow-hidden rounded bg-[var(--color-surface-2)]">
          <div
            className="h-full rounded bg-[var(--color-data-500)]"
            style={{ width: `${(tokens / 1200) * 100}%`, transition: trans }}
          />
        </div>
        {script.wait && (
          <p className="mt-2 text-xs italic text-[var(--color-unique-400)]">
            The “aha moment”: nobody programmed it to reconsider — reflection <em>emerged</em> from
            rewarding correct answers.
          </p>
        )}
      </div>

      <div className="grid grid-cols-2 gap-2 text-xs">
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5">
          <div className="font-semibold text-[var(--color-fg)]">Reward = verifiable</div>
          <p className="mt-0.5 text-[var(--color-muted)]">
            Not a learned reward model — just “is the math answer right? does the code pass tests?”
            Hard to game.
          </p>
        </div>
        <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5">
          <div className="font-semibold text-[var(--color-fg)]">GRPO vs PPO</div>
          <p className="mt-0.5 text-[var(--color-muted)]">
            PPO needs a separate critic network. GRPO deletes it — sample a{" "}
            <em>group</em> of answers; the group’s average <em>is</em> the baseline.
          </p>
        </div>
      </div>
    </div>
  );
}
