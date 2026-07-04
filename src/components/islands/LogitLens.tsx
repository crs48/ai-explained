import { useState } from "react";
import internals from "../../data/internals.json";

/** The logit lens: decode the residual stream at EVERY layer as if it were
 *  the last, and watch the final answer crystallize with depth — noise, then
 *  vaguely-related tokens, then the answer winning by wider margins.
 *  Curated/illustrative values (see internals.json); original method:
 *  nostalgebraist 2020. */

const { prompts, note } = internals.logitLens;

export default function LogitLens() {
  const [pIdx, setPIdx] = useState(0);
  const prompt = prompts[pIdx];
  const firstWin = prompt.layers.findIndex((l) => l.top[0].t === prompt.answer);

  return (
    <div className="flex h-full w-full flex-col gap-3">
      <div className="flex flex-wrap gap-1.5" role="group" aria-label="Prompt">
        {prompts.map((p, i) => (
          <button
            key={p.prompt}
            type="button"
            onClick={() => setPIdx(i)}
            aria-pressed={pIdx === i}
            className={
              "rounded-md px-2.5 py-1 text-xs " +
              (pIdx === i
                ? "bg-[var(--color-data-500)] text-white"
                : "border border-[var(--color-line)] text-[var(--color-muted)] hover:text-[var(--color-fg)]")
            }
          >
            “{p.prompt}…”
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto pr-1">
        <ol className="flex flex-col gap-1" aria-label="Per-layer top predictions, layer 0 at the top">
          {prompt.layers.map((l) => {
            const winner = l.top[0].t === prompt.answer;
            return (
              <li key={l.layer} className="flex items-center gap-2">
                <span className="w-12 shrink-0 text-right font-mono text-[10px] text-[var(--color-muted)]">
                  layer {l.layer}
                </span>
                <div className="flex min-w-0 flex-1 gap-1">
                  {l.top.map((tok, i) => (
                    <span
                      key={i}
                      className={
                        "overflow-hidden whitespace-nowrap rounded px-1.5 py-0.5 font-mono text-[11px] " +
                        (tok.t === prompt.answer
                          ? "text-[var(--color-ink)]"
                          : "text-[var(--color-muted)]")
                      }
                      style={{
                        background:
                          tok.t === prompt.answer
                            ? `color-mix(in oklab, var(--color-shared-400) ${Math.round(30 + tok.p * 70)}%, var(--color-surface-2))`
                            : "var(--color-surface-2)",
                        border:
                          winner && i === 0
                            ? "1px solid var(--color-shared-400)"
                            : "1px solid var(--color-line)",
                        minWidth: `${Math.max(3, tok.p * 100) * 0.9}%`,
                      }}
                      title={`${tok.t} — p ≈ ${tok.p}`}
                    >
                      {tok.t.trim()} <span className="opacity-60">{Math.round(tok.p * 100)}%</span>
                    </span>
                  ))}
                </div>
              </li>
            );
          })}
        </ol>
      </div>

      <div className="rounded-lg border border-[var(--color-line)] bg-[var(--color-surface-2)] p-2.5 text-xs text-[var(--color-fg)]" aria-live="polite">
        The answer <code className="text-[var(--color-shared-400)]">{prompt.answer.trim()}</code>{" "}
        first takes the lead at <strong>layer {firstWin}</strong> of {prompt.layers.length - 1} —
        early layers offer generic filler, middle layers narrow to the right <em>kind</em> of thing
        (cities, capitals), late layers just grow more certain. Depth isn't repetition; it's
        refinement.
      </div>

      <p className="text-[10px] text-[var(--color-muted)]">{note}</p>
    </div>
  );
}
