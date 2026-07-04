import { useEffect, useState } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/** How a raw pretrained LLM becomes a helpful assistant. Stepping through
 *  Base → SFT → RLHF shows the SAME model answering the SAME prompt three ways,
 *  and the "you be the labeler" pick illustrates where the RLHF signal comes from. */

const PROMPT = "How do I make pizza?";

type StageId = "base" | "sft" | "rlhf";

interface Stage {
  id: StageId;
  label: string;
  caption: string;
  /** Response lines. Rendered as a preformatted block. */
  response: string;
}

const STAGES: readonly Stage[] = [
  {
    id: "base",
    label: "Base (pretrained)",
    caption:
      "A raw pretrained model only predicts the next token — it completes text, it doesn't follow instructions.",
    response:
      "How do I make pizza? How do I make bread? How do I make pasta at home?\n" +
      "10 recipes you can make tonight. How do I make pizza dough from scratch?\n" +
      "How do I make pizza without an oven? Subscribe for more...",
  },
  {
    id: "sft",
    label: "+ Instruction tuning (SFT)",
    caption:
      "Fine-tuned on many instruction→response examples, it learns the assistant format and does what's asked.",
    response:
      "1. Make a dough with flour, water, yeast, and salt.\n" +
      "2. Let it rise, then stretch it into a round base.\n" +
      "3. Spread tomato sauce and add cheese and toppings.\n" +
      "4. Bake in a hot oven until the crust is golden.",
  },
  {
    id: "rlhf",
    label: "+ RLHF",
    caption:
      "Humans rank responses; a reward model learns their preferences; the model is optimized (PPO/DPO) to be helpful, harmless, and honest — this is what makes ChatGPT feel good to use.",
    response:
      "Great question — homemade pizza is easier than it looks! Here's a simple method:\n\n" +
      "1. Dough — Mix 250g flour, 150ml warm water, 1 tsp yeast, and a pinch of\n" +
      "   salt. Knead for a few minutes, then let it rise for about an hour.\n" +
      "2. Shape — Stretch the dough into a thin round on a floured surface.\n" +
      "3. Top — Spread a thin layer of tomato sauce, add mozzarella, then your\n" +
      "   favourite toppings.\n" +
      "4. Bake — Cook at the highest oven temperature (~250°C) for 8–10 minutes.\n\n" +
      "Tip: preheat your tray or a pizza stone so the base crisps up. Enjoy! 🍕",
  },
];

/** Accent CSS variables per stage: blue for base, teal for SFT, magenta for RLHF. */
const ACCENT: Record<StageId, { border: string; text: string; badge: string }> = {
  base: {
    border: "var(--color-data-500)",
    text: "var(--color-data-400)",
    badge: "var(--color-data-500)",
  },
  sft: {
    border: "var(--color-shared-500)",
    text: "var(--color-shared-400)",
    badge: "var(--color-shared-500)",
  },
  rlhf: {
    border: "var(--color-unique-500)",
    text: "var(--color-unique-400)",
    badge: "var(--color-unique-500)",
  },
};

interface Candidate {
  id: "A" | "B";
  helpful: boolean;
  text: string;
}

const CANDIDATES: readonly Candidate[] = [
  { id: "A", helpful: false, text: "Just buy one." },
  {
    id: "B",
    helpful: true,
    text: "Make a simple dough, add sauce, cheese, and toppings, then bake it in a hot oven until golden. Want the full recipe?",
  },
];

export default function Alignment() {
  const [stageId, setStageId] = useState<StageId>("base");
  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  const [picked, setPicked] = useState<"A" | "B" | null>(null);

  const stage = STAGES.find((s) => s.id === stageId) ?? STAGES[0];
  const accent = ACCENT[stage.id];

  return (
    <div className="flex h-full w-full flex-col gap-4">
      <div className="flex items-baseline gap-2">
        <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">User</span>
        <span className="font-mono text-sm text-[var(--color-fg)]">{PROMPT}</span>
      </div>

      <div className="flex flex-wrap gap-1 rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-1">
        {STAGES.map((s) => {
          const active = s.id === stageId;
          const a = ACCENT[s.id];
          return (
            <button
              key={s.id}
              type="button"
              aria-pressed={active}
              onClick={() => setStageId(s.id)}
              className={
                "flex-1 whitespace-nowrap rounded-md px-3 py-1.5 text-xs font-medium transition-colors " +
                (active
                  ? "text-white"
                  : "text-[var(--color-muted)] hover:text-[var(--color-fg)]")
              }
              style={active ? { background: a.badge } : undefined}
            >
              {s.label}
            </button>
          );
        })}
      </div>

      <div
        className="flex-1 rounded-xl border bg-[var(--color-surface)] p-4"
        style={{
          borderColor: accent.border,
          transition: reduce ? "none" : "border-color 200ms ease",
        }}
      >
        <div className="mb-2 flex items-center gap-2">
          <span
            className="rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white"
            style={{ background: accent.badge }}
          >
            {stage.label}
          </span>
          <span className="text-xs uppercase tracking-wide text-[var(--color-muted)]">
            Assistant
          </span>
        </div>
        <pre
          aria-live="polite"
          className="whitespace-pre-wrap font-mono text-sm leading-relaxed text-[var(--color-fg)]"
        >
          {stage.response}
        </pre>
        <p className="mt-4 text-xs leading-relaxed" style={{ color: accent.text }}>
          {stage.caption}
        </p>
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-3">
        <p className="text-xs font-semibold text-[var(--color-fg)]">You be the labeler</p>
        <p className="mt-0.5 text-xs text-[var(--color-muted)]">
          Same question, two candidate answers. Which is more helpful?
        </p>
        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          {CANDIDATES.map((c) => {
            const chosen = picked === c.id;
            return (
              <button
                key={c.id}
                type="button"
                aria-pressed={chosen}
                onClick={() => setPicked(c.id)}
                className={
                  "rounded-lg border p-2.5 text-left text-xs transition-colors " +
                  (chosen
                    ? "border-transparent text-white"
                    : "border-[var(--color-line)] bg-[var(--color-surface)] text-[var(--color-fg)] hover:border-[var(--color-muted)]")
                }
                style={
                  chosen
                    ? {
                        background: c.helpful
                          ? "var(--color-shared-500)"
                          : "var(--color-line)",
                      }
                    : undefined
                }
              >
                <span className="font-mono font-semibold">Response {c.id}</span>
                <span className="mt-1 block leading-relaxed">{c.text}</span>
              </button>
            );
          })}
        </div>
        <p className="mt-2 min-h-[1.25rem] text-xs" aria-live="polite">
          {picked === "B" && (
            <span className="font-medium text-[var(--color-unique-400)]">
              ✓ That preference is exactly the signal RLHF trains on.
            </span>
          )}
          {picked === "A" && (
            <span className="text-[var(--color-muted)]">
              Fair pick — but Response B is the more helpful one. That human judgment is what a
              reward model learns to imitate.
            </span>
          )}
        </p>
      </div>
    </div>
  );
}
