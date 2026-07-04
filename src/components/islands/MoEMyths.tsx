import { useEffect, useId, useState, type ReactNode } from "react";
import { onReducedMotionChange, prefersReducedMotion } from "../../lib/motion";

/**
 * Myth-vs-reality cards closing the Mixture of Experts track.
 *
 * Three common MoE misconceptions, each on a tappable card: the front states
 * the myth ("MYTH?"), a tap flips it to the reality ("BUSTED") with the
 * evidence. Cards open independently; once all three have been busted a
 * closing recap ties MoE back to the plain transformer the reader already knows.
 */

type MythId = "specialists" | "ensemble" | "cheap";

interface Accent {
  /** Card/tag color while the myth is still standing. */
  border: string;
  text: string;
}

interface Myth {
  id: MythId;
  accent: Accent;
  myth: string;
  verdict: string;
  reality: ReactNode;
  source: string;
}

const MYTHS: readonly Myth[] = [
  {
    id: "specialists",
    accent: { border: "var(--color-data-500)", text: "var(--color-data-400)" },
    myth: "Experts are topic specialists — a math expert, a law expert, a poetry expert.",
    verdict: "Mostly false.",
    reality: (
      <>
        Mixtral&rsquo;s own paper analyzed its routing and found{" "}
        <strong className="font-semibold text-[var(--color-unique-400)]">
          no obvious topic or domain specialization
        </strong>{" "}
        — ArXiv papers, biology, and philosophy documents route similarly. The structure that{" "}
        <em>does</em> exist is at the syntax/token level: Python&rsquo;s{" "}
        <code className="rounded bg-[var(--color-surface-2)] px-1 font-mono text-xs">self</code>{" "}
        and indentation whitespace consistently hit the same experts, and consecutive tokens often
        share experts. Research on ST-MoE found &ldquo;punctuation experts&rdquo; and &ldquo;number
        experts&rdquo; — not &ldquo;law experts.&rdquo;
      </>
    ),
    source: "Mixtral paper §5, arXiv 2401.04088; ST-MoE, arXiv 2202.08906.",
  },
  {
    id: "ensemble",
    accent: { border: "var(--color-weight-500)", text: "var(--color-weight-400)" },
    myth: "MoE is an ensemble — 8 separate models voting.",
    verdict: "False.",
    reality: (
      <>
        The experts are small FFN fragments living{" "}
        <strong className="font-semibold text-[var(--color-unique-400)]">
          inside every layer
        </strong>
        . A single token may use a different combination of experts at each of the model&rsquo;s
        32&ndash;94 layers — there are no standalone &ldquo;models&rdquo; to vote. That&rsquo;s also
        why Mixtral &ldquo;8&times;7B&rdquo; is 46.7B, not 56B: the experts share the attention
        layers.
      </>
    ),
    source: "HF “Mixture of Experts Explained”, huggingface.co/blog/moe.",
  },
  {
    id: "cheap",
    accent: { border: "var(--color-shared-500)", text: "var(--color-shared-400)" },
    myth: "Only the active experts need to be in memory, so MoE is cheap to run at home.",
    verdict: "False.",
    reality: (
      <>
        Every expert must be loaded — the router picks between them{" "}
        <em>per token, per layer</em>, so all weights must be resident.{" "}
        <strong className="font-semibold text-[var(--color-unique-400)]">
          Memory scales with TOTAL parameters; compute scales with ACTIVE parameters.
        </strong>{" "}
        Mixtral needs the VRAM of a ~47B model even though it computes like a ~13B one.
      </>
    ),
    source: "huggingface.co/blog/moe.",
  },
];

const RECAP =
  "the same transformer you already know, with each block’s feed-forward layer swapped for a router and a bench of experts — huge capacity, small per-token cost.";

const INITIAL: Record<MythId, boolean> = {
  specialists: false,
  ensemble: false,
  cheap: false,
};

export default function MoEMyths() {
  const baseId = useId();

  // Read reduced-motion after mount so SSR and first client render match.
  const [reduce, setReduce] = useState(false);
  useEffect(() => {
    setReduce(prefersReducedMotion());
    return onReducedMotionChange(setReduce);
  }, []);

  /** Which cards are currently showing their reality. */
  const [open, setOpen] = useState<Record<MythId, boolean>>(INITIAL);
  /** Which myths have been revealed at least once — busted stays busted. */
  const [busted, setBusted] = useState<Record<MythId, boolean>>(INITIAL);

  const bustedCount = MYTHS.filter((m) => busted[m.id]).length;
  const allBusted = bustedCount === MYTHS.length;

  const toggle = (id: MythId) => {
    setOpen((prev) => ({ ...prev, [id]: !prev[id] }));
    setBusted((prev) => (prev[id] ? prev : { ...prev, [id]: true }));
  };

  return (
    <div className="flex h-full w-full flex-col gap-3">
      {/* Header + progress */}
      <div className="flex items-baseline justify-between gap-2">
        <p className="text-xs text-[var(--color-muted)]">
          Three things people get wrong about Mixture of Experts. Tap a card to check it against the
          research.
        </p>
        <span className="shrink-0 whitespace-nowrap font-mono text-xs text-[var(--color-muted)]">
          {bustedCount}/{MYTHS.length} busted
        </span>
      </div>

      {/* Myth cards */}
      <div className="flex flex-1 flex-col gap-3">
        {MYTHS.map((m) => {
          const isOpen = open[m.id];
          const wasBusted = busted[m.id];
          const panelId = `${baseId}-${m.id}-panel`;
          return (
            <section
              key={m.id}
              className="flex flex-col rounded-lg border bg-[var(--color-surface)]"
              style={{
                borderColor: isOpen
                  ? "var(--color-unique-500)"
                  : `color-mix(in srgb, ${m.accent.border} 45%, transparent)`,
                transition: reduce ? "none" : "border-color 200ms ease",
              }}
            >
              <button
                type="button"
                aria-expanded={isOpen}
                aria-controls={panelId}
                onClick={() => toggle(m.id)}
                className="flex w-full items-start gap-2.5 rounded-lg p-3 text-left"
              >
                <span
                  className={
                    "mt-0.5 shrink-0 rounded px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide " +
                    (wasBusted
                      ? "bg-[var(--color-unique-500)] text-white"
                      : "bg-[var(--color-surface-2)]")
                  }
                  style={wasBusted ? undefined : { color: m.accent.text }}
                >
                  {wasBusted ? "Busted" : "Myth?"}
                </span>
                <span className="flex-1 text-sm leading-relaxed text-[var(--color-fg)]">
                  &ldquo;{m.myth}&rdquo;
                </span>
                <span
                  aria-hidden="true"
                  className="mt-0.5 shrink-0 font-mono text-xs text-[var(--color-muted)]"
                >
                  {isOpen ? "−" : "+"}
                </span>
              </button>

              {/* Always-mounted live region so the reveal is announced. */}
              <div id={panelId} aria-live="polite">
                {isOpen && (
                  <div className="flex flex-col gap-2 rounded-b-lg border-t border-[var(--color-line)] bg-[var(--color-unique-500)]/5 px-3 pb-3 pt-2.5">
                    <p className="text-sm leading-relaxed text-[var(--color-fg)]">
                      <span className="font-semibold text-[var(--color-unique-400)]">
                        {m.verdict}
                      </span>{" "}
                      {m.reality}
                    </p>
                    <p className="text-xs text-[var(--color-muted)]">Source: {m.source}</p>
                  </div>
                )}
              </div>
            </section>
          );
        })}
      </div>

      {/* Closing recap once every myth is busted */}
      <div aria-live="polite" className="mt-auto">
        {allBusted && (
          <p className="rounded-lg border border-[var(--color-shared-500)]/40 bg-[var(--color-surface-2)] p-3 text-sm leading-relaxed text-[var(--color-fg)]">
            <span className="font-semibold text-[var(--color-shared-400)]">
              That&rsquo;s Mixture of Experts:
            </span>{" "}
            {RECAP}
          </p>
        )}
      </div>
    </div>
  );
}
